import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging, TokenMessage, TopicMessage } from 'firebase-admin/messaging';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Firebase Cloud Messaging transport for push notifications.
 *
 * Credential: `FIREBASE_SERVICE_ACCOUNT` = the service-account JSON from the
 * Firebase console (Project settings → Service accounts), either raw or
 * base64-encoded. When it is missing FCM sending is skipped (logged once) so
 * local dev and the legacy Pushy path keep working.
 *
 * Payload shape: FCM data values must be strings, so the whole notification
 * object (typed ints, nested objects) goes JSON-encoded under `payload`. The
 * app decodes it back into exactly the map Pushy used to deliver.
 *
 * Android gets a data-only, high-priority message: the app displays it itself
 * so it can skip the user's own actions and save it to the in-app inbox.
 * iOS gets an APNs alert (shown by the system in the background) plus
 * `content-available` so the app can save it to the inbox.
 */

/** Tokens FCM reports as gone for good (app uninstalled, token deleted). */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** sendEachForMulticast accepts at most 500 tokens per call. */
const MULTICAST_LIMIT = 500;

export interface FcmSendResult {
  successCount: number;
  failureCount: number;
  /** Tokens that will never deliver again — deactivate their devices. */
  deadTokens: string[];
}

class FcmService {
  private static instance: FcmService;
  private messaging: Messaging | null = null;
  private initAttempted = false;

  public static getInstance(): FcmService {
    if (!FcmService.instance) {
      FcmService.instance = new FcmService();
    }
    return FcmService.instance;
  }

  /** True when a service account is configured and Firebase started. */
  public isConfigured(): boolean {
    return this.getMessaging() !== null;
  }

  private getMessaging(): Messaging | null {
    if (this.initAttempted) return this.messaging;
    this.initAttempted = true;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      console.warn('FCM disabled: FIREBASE_SERVICE_ACCOUNT is not set');
      return null;
    }

    try {
      const serviceAccount = parseServiceAccount(raw);
      const app: App = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
      this.messaging = getMessaging(app);
      console.log('FcmService initialized successfully');
    } catch (error: any) {
      console.error('FCM disabled: could not initialise Firebase:', error.message || error);
      this.messaging = null;
    }
    return this.messaging;
  }

  public async sendToTopic(topic: string, title: string, body: string, payload: Record<string, any>): Promise<string> {
    const messaging = this.getMessaging();
    if (!messaging) throw new Error('FCM is not configured');

    const message: TopicMessage = { topic, ...buildMessage(title, body, payload) };
    return messaging.send(message);
  }

  public async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    payload: Record<string, any>
  ): Promise<FcmSendResult> {
    const messaging = this.getMessaging();
    if (!messaging) throw new Error('FCM is not configured');

    const result: FcmSendResult = { successCount: 0, failureCount: 0, deadTokens: [] };
    const base = buildMessage(title, body, payload);

    for (let i = 0; i < tokens.length; i += MULTICAST_LIMIT) {
      const batch = tokens.slice(i, i + MULTICAST_LIMIT);
      const response = await messaging.sendEachForMulticast({ tokens: batch, ...base });
      result.successCount += response.successCount;
      result.failureCount += response.failureCount;
      response.responses.forEach((r, index) => {
        if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
          result.deadTokens.push(batch[index]);
        }
      });
    }
    return result;
  }

  /**
   * FCM has no API to list a token's topics, so the caller passes every topic
   * the device could hold. Unsubscribing from a topic it never joined is a
   * no-op.
   */
  public async unsubscribeFromTopics(token: string, topics: string[]): Promise<string[]> {
    const messaging = this.getMessaging();
    if (!messaging) throw new Error('FCM is not configured');

    const unsubscribed: string[] = [];
    for (const topic of topics) {
      try {
        const response = await messaging.unsubscribeFromTopic([token], topic);
        if (response.failureCount === 0) unsubscribed.push(topic);
      } catch (error: any) {
        console.error(`Failed to unsubscribe FCM token from topic ${topic}:`, error.message || error);
      }
    }
    return unsubscribed;
  }
}

function parseServiceAccount(raw: string): Record<string, any> {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(text);
}

export function buildMessage(title: string, body: string, payload: Record<string, any>): Omit<TokenMessage, 'token'> {
  return {
    data: { payload: JSON.stringify(payload) },
    android: { priority: 'high' },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          contentAvailable: true,
        },
      },
    },
  };
}

export default FcmService.getInstance();
