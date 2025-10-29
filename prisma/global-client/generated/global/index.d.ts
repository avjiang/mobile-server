
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model SubscriptionPlan
 * 
 */
export type SubscriptionPlan = $Result.DefaultSelection<Prisma.$SubscriptionPlanPayload>
/**
 * Model SubscriptionAddOn
 * 
 */
export type SubscriptionAddOn = $Result.DefaultSelection<Prisma.$SubscriptionAddOnPayload>
/**
 * Model Tenant
 * 
 */
export type Tenant = $Result.DefaultSelection<Prisma.$TenantPayload>
/**
 * Model TenantSubscription
 * 
 */
export type TenantSubscription = $Result.DefaultSelection<Prisma.$TenantSubscriptionPayload>
/**
 * Model TenantSubscriptionAddOn
 * 
 */
export type TenantSubscriptionAddOn = $Result.DefaultSelection<Prisma.$TenantSubscriptionAddOnPayload>
/**
 * Model TenantOutlet
 * 
 */
export type TenantOutlet = $Result.DefaultSelection<Prisma.$TenantOutletPayload>
/**
 * Model Discount
 * 
 */
export type Discount = $Result.DefaultSelection<Prisma.$DiscountPayload>
/**
 * Model TenantUser
 * 
 */
export type TenantUser = $Result.DefaultSelection<Prisma.$TenantUserPayload>
/**
 * Model RefreshToken
 * 
 */
export type RefreshToken = $Result.DefaultSelection<Prisma.$RefreshTokenPayload>
/**
 * Model Permission
 * 
 */
export type Permission = $Result.DefaultSelection<Prisma.$PermissionPayload>
/**
 * Model SettingDefinition
 * 
 */
export type SettingDefinition = $Result.DefaultSelection<Prisma.$SettingDefinitionPayload>
/**
 * Model PushyDevice
 * 
 */
export type PushyDevice = $Result.DefaultSelection<Prisma.$PushyDevicePayload>
/**
 * Model PushySubscription
 * 
 */
export type PushySubscription = $Result.DefaultSelection<Prisma.$PushySubscriptionPayload>
/**
 * Model PushyDeviceAllocation
 * 
 */
export type PushyDeviceAllocation = $Result.DefaultSelection<Prisma.$PushyDeviceAllocationPayload>
/**
 * Model TenantWarehouse
 * 
 */
export type TenantWarehouse = $Result.DefaultSelection<Prisma.$TenantWarehousePayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more SubscriptionPlans
 * const subscriptionPlans = await prisma.subscriptionPlan.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more SubscriptionPlans
   * const subscriptionPlans = await prisma.subscriptionPlan.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.subscriptionPlan`: Exposes CRUD operations for the **SubscriptionPlan** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SubscriptionPlans
    * const subscriptionPlans = await prisma.subscriptionPlan.findMany()
    * ```
    */
  get subscriptionPlan(): Prisma.SubscriptionPlanDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.subscriptionAddOn`: Exposes CRUD operations for the **SubscriptionAddOn** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SubscriptionAddOns
    * const subscriptionAddOns = await prisma.subscriptionAddOn.findMany()
    * ```
    */
  get subscriptionAddOn(): Prisma.SubscriptionAddOnDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tenant`: Exposes CRUD operations for the **Tenant** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Tenants
    * const tenants = await prisma.tenant.findMany()
    * ```
    */
  get tenant(): Prisma.TenantDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tenantSubscription`: Exposes CRUD operations for the **TenantSubscription** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TenantSubscriptions
    * const tenantSubscriptions = await prisma.tenantSubscription.findMany()
    * ```
    */
  get tenantSubscription(): Prisma.TenantSubscriptionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tenantSubscriptionAddOn`: Exposes CRUD operations for the **TenantSubscriptionAddOn** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TenantSubscriptionAddOns
    * const tenantSubscriptionAddOns = await prisma.tenantSubscriptionAddOn.findMany()
    * ```
    */
  get tenantSubscriptionAddOn(): Prisma.TenantSubscriptionAddOnDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tenantOutlet`: Exposes CRUD operations for the **TenantOutlet** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TenantOutlets
    * const tenantOutlets = await prisma.tenantOutlet.findMany()
    * ```
    */
  get tenantOutlet(): Prisma.TenantOutletDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.discount`: Exposes CRUD operations for the **Discount** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Discounts
    * const discounts = await prisma.discount.findMany()
    * ```
    */
  get discount(): Prisma.DiscountDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tenantUser`: Exposes CRUD operations for the **TenantUser** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TenantUsers
    * const tenantUsers = await prisma.tenantUser.findMany()
    * ```
    */
  get tenantUser(): Prisma.TenantUserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.refreshToken`: Exposes CRUD operations for the **RefreshToken** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RefreshTokens
    * const refreshTokens = await prisma.refreshToken.findMany()
    * ```
    */
  get refreshToken(): Prisma.RefreshTokenDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.permission`: Exposes CRUD operations for the **Permission** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Permissions
    * const permissions = await prisma.permission.findMany()
    * ```
    */
  get permission(): Prisma.PermissionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.settingDefinition`: Exposes CRUD operations for the **SettingDefinition** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SettingDefinitions
    * const settingDefinitions = await prisma.settingDefinition.findMany()
    * ```
    */
  get settingDefinition(): Prisma.SettingDefinitionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.pushyDevice`: Exposes CRUD operations for the **PushyDevice** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PushyDevices
    * const pushyDevices = await prisma.pushyDevice.findMany()
    * ```
    */
  get pushyDevice(): Prisma.PushyDeviceDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.pushySubscription`: Exposes CRUD operations for the **PushySubscription** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PushySubscriptions
    * const pushySubscriptions = await prisma.pushySubscription.findMany()
    * ```
    */
  get pushySubscription(): Prisma.PushySubscriptionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.pushyDeviceAllocation`: Exposes CRUD operations for the **PushyDeviceAllocation** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PushyDeviceAllocations
    * const pushyDeviceAllocations = await prisma.pushyDeviceAllocation.findMany()
    * ```
    */
  get pushyDeviceAllocation(): Prisma.PushyDeviceAllocationDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tenantWarehouse`: Exposes CRUD operations for the **TenantWarehouse** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TenantWarehouses
    * const tenantWarehouses = await prisma.tenantWarehouse.findMany()
    * ```
    */
  get tenantWarehouse(): Prisma.TenantWarehouseDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.7.0
   * Query Engine version: 3cff47a7f5d65c3ea74883f1d736e41d68ce91ed
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    SubscriptionPlan: 'SubscriptionPlan',
    SubscriptionAddOn: 'SubscriptionAddOn',
    Tenant: 'Tenant',
    TenantSubscription: 'TenantSubscription',
    TenantSubscriptionAddOn: 'TenantSubscriptionAddOn',
    TenantOutlet: 'TenantOutlet',
    Discount: 'Discount',
    TenantUser: 'TenantUser',
    RefreshToken: 'RefreshToken',
    Permission: 'Permission',
    SettingDefinition: 'SettingDefinition',
    PushyDevice: 'PushyDevice',
    PushySubscription: 'PushySubscription',
    PushyDeviceAllocation: 'PushyDeviceAllocation',
    TenantWarehouse: 'TenantWarehouse'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "subscriptionPlan" | "subscriptionAddOn" | "tenant" | "tenantSubscription" | "tenantSubscriptionAddOn" | "tenantOutlet" | "discount" | "tenantUser" | "refreshToken" | "permission" | "settingDefinition" | "pushyDevice" | "pushySubscription" | "pushyDeviceAllocation" | "tenantWarehouse"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      SubscriptionPlan: {
        payload: Prisma.$SubscriptionPlanPayload<ExtArgs>
        fields: Prisma.SubscriptionPlanFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SubscriptionPlanFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SubscriptionPlanFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload>
          }
          findFirst: {
            args: Prisma.SubscriptionPlanFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SubscriptionPlanFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload>
          }
          findMany: {
            args: Prisma.SubscriptionPlanFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload>[]
          }
          create: {
            args: Prisma.SubscriptionPlanCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload>
          }
          createMany: {
            args: Prisma.SubscriptionPlanCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.SubscriptionPlanDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload>
          }
          update: {
            args: Prisma.SubscriptionPlanUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload>
          }
          deleteMany: {
            args: Prisma.SubscriptionPlanDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SubscriptionPlanUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.SubscriptionPlanUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPlanPayload>
          }
          aggregate: {
            args: Prisma.SubscriptionPlanAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSubscriptionPlan>
          }
          groupBy: {
            args: Prisma.SubscriptionPlanGroupByArgs<ExtArgs>
            result: $Utils.Optional<SubscriptionPlanGroupByOutputType>[]
          }
          count: {
            args: Prisma.SubscriptionPlanCountArgs<ExtArgs>
            result: $Utils.Optional<SubscriptionPlanCountAggregateOutputType> | number
          }
        }
      }
      SubscriptionAddOn: {
        payload: Prisma.$SubscriptionAddOnPayload<ExtArgs>
        fields: Prisma.SubscriptionAddOnFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SubscriptionAddOnFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SubscriptionAddOnFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload>
          }
          findFirst: {
            args: Prisma.SubscriptionAddOnFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SubscriptionAddOnFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload>
          }
          findMany: {
            args: Prisma.SubscriptionAddOnFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload>[]
          }
          create: {
            args: Prisma.SubscriptionAddOnCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload>
          }
          createMany: {
            args: Prisma.SubscriptionAddOnCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.SubscriptionAddOnDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload>
          }
          update: {
            args: Prisma.SubscriptionAddOnUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload>
          }
          deleteMany: {
            args: Prisma.SubscriptionAddOnDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SubscriptionAddOnUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.SubscriptionAddOnUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionAddOnPayload>
          }
          aggregate: {
            args: Prisma.SubscriptionAddOnAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSubscriptionAddOn>
          }
          groupBy: {
            args: Prisma.SubscriptionAddOnGroupByArgs<ExtArgs>
            result: $Utils.Optional<SubscriptionAddOnGroupByOutputType>[]
          }
          count: {
            args: Prisma.SubscriptionAddOnCountArgs<ExtArgs>
            result: $Utils.Optional<SubscriptionAddOnCountAggregateOutputType> | number
          }
        }
      }
      Tenant: {
        payload: Prisma.$TenantPayload<ExtArgs>
        fields: Prisma.TenantFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TenantFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TenantFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          findFirst: {
            args: Prisma.TenantFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TenantFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          findMany: {
            args: Prisma.TenantFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>[]
          }
          create: {
            args: Prisma.TenantCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          createMany: {
            args: Prisma.TenantCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.TenantDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          update: {
            args: Prisma.TenantUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          deleteMany: {
            args: Prisma.TenantDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TenantUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TenantUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>
          }
          aggregate: {
            args: Prisma.TenantAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTenant>
          }
          groupBy: {
            args: Prisma.TenantGroupByArgs<ExtArgs>
            result: $Utils.Optional<TenantGroupByOutputType>[]
          }
          count: {
            args: Prisma.TenantCountArgs<ExtArgs>
            result: $Utils.Optional<TenantCountAggregateOutputType> | number
          }
        }
      }
      TenantSubscription: {
        payload: Prisma.$TenantSubscriptionPayload<ExtArgs>
        fields: Prisma.TenantSubscriptionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TenantSubscriptionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TenantSubscriptionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload>
          }
          findFirst: {
            args: Prisma.TenantSubscriptionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TenantSubscriptionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload>
          }
          findMany: {
            args: Prisma.TenantSubscriptionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload>[]
          }
          create: {
            args: Prisma.TenantSubscriptionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload>
          }
          createMany: {
            args: Prisma.TenantSubscriptionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.TenantSubscriptionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload>
          }
          update: {
            args: Prisma.TenantSubscriptionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload>
          }
          deleteMany: {
            args: Prisma.TenantSubscriptionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TenantSubscriptionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TenantSubscriptionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionPayload>
          }
          aggregate: {
            args: Prisma.TenantSubscriptionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTenantSubscription>
          }
          groupBy: {
            args: Prisma.TenantSubscriptionGroupByArgs<ExtArgs>
            result: $Utils.Optional<TenantSubscriptionGroupByOutputType>[]
          }
          count: {
            args: Prisma.TenantSubscriptionCountArgs<ExtArgs>
            result: $Utils.Optional<TenantSubscriptionCountAggregateOutputType> | number
          }
        }
      }
      TenantSubscriptionAddOn: {
        payload: Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>
        fields: Prisma.TenantSubscriptionAddOnFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TenantSubscriptionAddOnFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TenantSubscriptionAddOnFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload>
          }
          findFirst: {
            args: Prisma.TenantSubscriptionAddOnFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TenantSubscriptionAddOnFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload>
          }
          findMany: {
            args: Prisma.TenantSubscriptionAddOnFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload>[]
          }
          create: {
            args: Prisma.TenantSubscriptionAddOnCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload>
          }
          createMany: {
            args: Prisma.TenantSubscriptionAddOnCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.TenantSubscriptionAddOnDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload>
          }
          update: {
            args: Prisma.TenantSubscriptionAddOnUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload>
          }
          deleteMany: {
            args: Prisma.TenantSubscriptionAddOnDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TenantSubscriptionAddOnUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TenantSubscriptionAddOnUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantSubscriptionAddOnPayload>
          }
          aggregate: {
            args: Prisma.TenantSubscriptionAddOnAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTenantSubscriptionAddOn>
          }
          groupBy: {
            args: Prisma.TenantSubscriptionAddOnGroupByArgs<ExtArgs>
            result: $Utils.Optional<TenantSubscriptionAddOnGroupByOutputType>[]
          }
          count: {
            args: Prisma.TenantSubscriptionAddOnCountArgs<ExtArgs>
            result: $Utils.Optional<TenantSubscriptionAddOnCountAggregateOutputType> | number
          }
        }
      }
      TenantOutlet: {
        payload: Prisma.$TenantOutletPayload<ExtArgs>
        fields: Prisma.TenantOutletFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TenantOutletFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TenantOutletFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload>
          }
          findFirst: {
            args: Prisma.TenantOutletFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TenantOutletFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload>
          }
          findMany: {
            args: Prisma.TenantOutletFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload>[]
          }
          create: {
            args: Prisma.TenantOutletCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload>
          }
          createMany: {
            args: Prisma.TenantOutletCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.TenantOutletDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload>
          }
          update: {
            args: Prisma.TenantOutletUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload>
          }
          deleteMany: {
            args: Prisma.TenantOutletDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TenantOutletUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TenantOutletUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantOutletPayload>
          }
          aggregate: {
            args: Prisma.TenantOutletAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTenantOutlet>
          }
          groupBy: {
            args: Prisma.TenantOutletGroupByArgs<ExtArgs>
            result: $Utils.Optional<TenantOutletGroupByOutputType>[]
          }
          count: {
            args: Prisma.TenantOutletCountArgs<ExtArgs>
            result: $Utils.Optional<TenantOutletCountAggregateOutputType> | number
          }
        }
      }
      Discount: {
        payload: Prisma.$DiscountPayload<ExtArgs>
        fields: Prisma.DiscountFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DiscountFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DiscountFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload>
          }
          findFirst: {
            args: Prisma.DiscountFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DiscountFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload>
          }
          findMany: {
            args: Prisma.DiscountFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload>[]
          }
          create: {
            args: Prisma.DiscountCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload>
          }
          createMany: {
            args: Prisma.DiscountCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.DiscountDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload>
          }
          update: {
            args: Prisma.DiscountUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload>
          }
          deleteMany: {
            args: Prisma.DiscountDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DiscountUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.DiscountUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiscountPayload>
          }
          aggregate: {
            args: Prisma.DiscountAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDiscount>
          }
          groupBy: {
            args: Prisma.DiscountGroupByArgs<ExtArgs>
            result: $Utils.Optional<DiscountGroupByOutputType>[]
          }
          count: {
            args: Prisma.DiscountCountArgs<ExtArgs>
            result: $Utils.Optional<DiscountCountAggregateOutputType> | number
          }
        }
      }
      TenantUser: {
        payload: Prisma.$TenantUserPayload<ExtArgs>
        fields: Prisma.TenantUserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TenantUserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TenantUserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload>
          }
          findFirst: {
            args: Prisma.TenantUserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TenantUserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload>
          }
          findMany: {
            args: Prisma.TenantUserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload>[]
          }
          create: {
            args: Prisma.TenantUserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload>
          }
          createMany: {
            args: Prisma.TenantUserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.TenantUserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload>
          }
          update: {
            args: Prisma.TenantUserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload>
          }
          deleteMany: {
            args: Prisma.TenantUserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TenantUserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TenantUserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantUserPayload>
          }
          aggregate: {
            args: Prisma.TenantUserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTenantUser>
          }
          groupBy: {
            args: Prisma.TenantUserGroupByArgs<ExtArgs>
            result: $Utils.Optional<TenantUserGroupByOutputType>[]
          }
          count: {
            args: Prisma.TenantUserCountArgs<ExtArgs>
            result: $Utils.Optional<TenantUserCountAggregateOutputType> | number
          }
        }
      }
      RefreshToken: {
        payload: Prisma.$RefreshTokenPayload<ExtArgs>
        fields: Prisma.RefreshTokenFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RefreshTokenFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RefreshTokenFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>
          }
          findFirst: {
            args: Prisma.RefreshTokenFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RefreshTokenFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>
          }
          findMany: {
            args: Prisma.RefreshTokenFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>[]
          }
          create: {
            args: Prisma.RefreshTokenCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>
          }
          createMany: {
            args: Prisma.RefreshTokenCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.RefreshTokenDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>
          }
          update: {
            args: Prisma.RefreshTokenUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>
          }
          deleteMany: {
            args: Prisma.RefreshTokenDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RefreshTokenUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.RefreshTokenUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>
          }
          aggregate: {
            args: Prisma.RefreshTokenAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRefreshToken>
          }
          groupBy: {
            args: Prisma.RefreshTokenGroupByArgs<ExtArgs>
            result: $Utils.Optional<RefreshTokenGroupByOutputType>[]
          }
          count: {
            args: Prisma.RefreshTokenCountArgs<ExtArgs>
            result: $Utils.Optional<RefreshTokenCountAggregateOutputType> | number
          }
        }
      }
      Permission: {
        payload: Prisma.$PermissionPayload<ExtArgs>
        fields: Prisma.PermissionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PermissionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PermissionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload>
          }
          findFirst: {
            args: Prisma.PermissionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PermissionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload>
          }
          findMany: {
            args: Prisma.PermissionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload>[]
          }
          create: {
            args: Prisma.PermissionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload>
          }
          createMany: {
            args: Prisma.PermissionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.PermissionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload>
          }
          update: {
            args: Prisma.PermissionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload>
          }
          deleteMany: {
            args: Prisma.PermissionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PermissionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PermissionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PermissionPayload>
          }
          aggregate: {
            args: Prisma.PermissionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePermission>
          }
          groupBy: {
            args: Prisma.PermissionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PermissionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PermissionCountArgs<ExtArgs>
            result: $Utils.Optional<PermissionCountAggregateOutputType> | number
          }
        }
      }
      SettingDefinition: {
        payload: Prisma.$SettingDefinitionPayload<ExtArgs>
        fields: Prisma.SettingDefinitionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SettingDefinitionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SettingDefinitionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload>
          }
          findFirst: {
            args: Prisma.SettingDefinitionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SettingDefinitionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload>
          }
          findMany: {
            args: Prisma.SettingDefinitionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload>[]
          }
          create: {
            args: Prisma.SettingDefinitionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload>
          }
          createMany: {
            args: Prisma.SettingDefinitionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.SettingDefinitionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload>
          }
          update: {
            args: Prisma.SettingDefinitionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload>
          }
          deleteMany: {
            args: Prisma.SettingDefinitionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SettingDefinitionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.SettingDefinitionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SettingDefinitionPayload>
          }
          aggregate: {
            args: Prisma.SettingDefinitionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSettingDefinition>
          }
          groupBy: {
            args: Prisma.SettingDefinitionGroupByArgs<ExtArgs>
            result: $Utils.Optional<SettingDefinitionGroupByOutputType>[]
          }
          count: {
            args: Prisma.SettingDefinitionCountArgs<ExtArgs>
            result: $Utils.Optional<SettingDefinitionCountAggregateOutputType> | number
          }
        }
      }
      PushyDevice: {
        payload: Prisma.$PushyDevicePayload<ExtArgs>
        fields: Prisma.PushyDeviceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PushyDeviceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PushyDeviceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload>
          }
          findFirst: {
            args: Prisma.PushyDeviceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PushyDeviceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload>
          }
          findMany: {
            args: Prisma.PushyDeviceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload>[]
          }
          create: {
            args: Prisma.PushyDeviceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload>
          }
          createMany: {
            args: Prisma.PushyDeviceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.PushyDeviceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload>
          }
          update: {
            args: Prisma.PushyDeviceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload>
          }
          deleteMany: {
            args: Prisma.PushyDeviceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PushyDeviceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PushyDeviceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDevicePayload>
          }
          aggregate: {
            args: Prisma.PushyDeviceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePushyDevice>
          }
          groupBy: {
            args: Prisma.PushyDeviceGroupByArgs<ExtArgs>
            result: $Utils.Optional<PushyDeviceGroupByOutputType>[]
          }
          count: {
            args: Prisma.PushyDeviceCountArgs<ExtArgs>
            result: $Utils.Optional<PushyDeviceCountAggregateOutputType> | number
          }
        }
      }
      PushySubscription: {
        payload: Prisma.$PushySubscriptionPayload<ExtArgs>
        fields: Prisma.PushySubscriptionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PushySubscriptionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PushySubscriptionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload>
          }
          findFirst: {
            args: Prisma.PushySubscriptionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PushySubscriptionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload>
          }
          findMany: {
            args: Prisma.PushySubscriptionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload>[]
          }
          create: {
            args: Prisma.PushySubscriptionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload>
          }
          createMany: {
            args: Prisma.PushySubscriptionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.PushySubscriptionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload>
          }
          update: {
            args: Prisma.PushySubscriptionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload>
          }
          deleteMany: {
            args: Prisma.PushySubscriptionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PushySubscriptionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PushySubscriptionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushySubscriptionPayload>
          }
          aggregate: {
            args: Prisma.PushySubscriptionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePushySubscription>
          }
          groupBy: {
            args: Prisma.PushySubscriptionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PushySubscriptionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PushySubscriptionCountArgs<ExtArgs>
            result: $Utils.Optional<PushySubscriptionCountAggregateOutputType> | number
          }
        }
      }
      PushyDeviceAllocation: {
        payload: Prisma.$PushyDeviceAllocationPayload<ExtArgs>
        fields: Prisma.PushyDeviceAllocationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PushyDeviceAllocationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PushyDeviceAllocationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload>
          }
          findFirst: {
            args: Prisma.PushyDeviceAllocationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PushyDeviceAllocationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload>
          }
          findMany: {
            args: Prisma.PushyDeviceAllocationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload>[]
          }
          create: {
            args: Prisma.PushyDeviceAllocationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload>
          }
          createMany: {
            args: Prisma.PushyDeviceAllocationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.PushyDeviceAllocationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload>
          }
          update: {
            args: Prisma.PushyDeviceAllocationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload>
          }
          deleteMany: {
            args: Prisma.PushyDeviceAllocationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PushyDeviceAllocationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PushyDeviceAllocationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PushyDeviceAllocationPayload>
          }
          aggregate: {
            args: Prisma.PushyDeviceAllocationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePushyDeviceAllocation>
          }
          groupBy: {
            args: Prisma.PushyDeviceAllocationGroupByArgs<ExtArgs>
            result: $Utils.Optional<PushyDeviceAllocationGroupByOutputType>[]
          }
          count: {
            args: Prisma.PushyDeviceAllocationCountArgs<ExtArgs>
            result: $Utils.Optional<PushyDeviceAllocationCountAggregateOutputType> | number
          }
        }
      }
      TenantWarehouse: {
        payload: Prisma.$TenantWarehousePayload<ExtArgs>
        fields: Prisma.TenantWarehouseFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TenantWarehouseFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TenantWarehouseFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload>
          }
          findFirst: {
            args: Prisma.TenantWarehouseFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TenantWarehouseFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload>
          }
          findMany: {
            args: Prisma.TenantWarehouseFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload>[]
          }
          create: {
            args: Prisma.TenantWarehouseCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload>
          }
          createMany: {
            args: Prisma.TenantWarehouseCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.TenantWarehouseDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload>
          }
          update: {
            args: Prisma.TenantWarehouseUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload>
          }
          deleteMany: {
            args: Prisma.TenantWarehouseDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TenantWarehouseUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TenantWarehouseUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TenantWarehousePayload>
          }
          aggregate: {
            args: Prisma.TenantWarehouseAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTenantWarehouse>
          }
          groupBy: {
            args: Prisma.TenantWarehouseGroupByArgs<ExtArgs>
            result: $Utils.Optional<TenantWarehouseGroupByOutputType>[]
          }
          count: {
            args: Prisma.TenantWarehouseCountArgs<ExtArgs>
            result: $Utils.Optional<TenantWarehouseCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    subscriptionPlan?: SubscriptionPlanOmit
    subscriptionAddOn?: SubscriptionAddOnOmit
    tenant?: TenantOmit
    tenantSubscription?: TenantSubscriptionOmit
    tenantSubscriptionAddOn?: TenantSubscriptionAddOnOmit
    tenantOutlet?: TenantOutletOmit
    discount?: DiscountOmit
    tenantUser?: TenantUserOmit
    refreshToken?: RefreshTokenOmit
    permission?: PermissionOmit
    settingDefinition?: SettingDefinitionOmit
    pushyDevice?: PushyDeviceOmit
    pushySubscription?: PushySubscriptionOmit
    pushyDeviceAllocation?: PushyDeviceAllocationOmit
    tenantWarehouse?: TenantWarehouseOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type SubscriptionPlanCountOutputType
   */

  export type SubscriptionPlanCountOutputType = {
    subscription: number
  }

  export type SubscriptionPlanCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscription?: boolean | SubscriptionPlanCountOutputTypeCountSubscriptionArgs
  }

  // Custom InputTypes
  /**
   * SubscriptionPlanCountOutputType without action
   */
  export type SubscriptionPlanCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlanCountOutputType
     */
    select?: SubscriptionPlanCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * SubscriptionPlanCountOutputType without action
   */
  export type SubscriptionPlanCountOutputTypeCountSubscriptionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantSubscriptionWhereInput
  }


  /**
   * Count Type SubscriptionAddOnCountOutputType
   */

  export type SubscriptionAddOnCountOutputType = {
    subscriptions: number
  }

  export type SubscriptionAddOnCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscriptions?: boolean | SubscriptionAddOnCountOutputTypeCountSubscriptionsArgs
  }

  // Custom InputTypes
  /**
   * SubscriptionAddOnCountOutputType without action
   */
  export type SubscriptionAddOnCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOnCountOutputType
     */
    select?: SubscriptionAddOnCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * SubscriptionAddOnCountOutputType without action
   */
  export type SubscriptionAddOnCountOutputTypeCountSubscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantSubscriptionAddOnWhereInput
  }


  /**
   * Count Type TenantCountOutputType
   */

  export type TenantCountOutputType = {
    tenantUsers: number
    subscription: number
    tenantOutlets: number
    deviceAllocations: number
    warehouses: number
  }

  export type TenantCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    tenantUsers?: boolean | TenantCountOutputTypeCountTenantUsersArgs
    subscription?: boolean | TenantCountOutputTypeCountSubscriptionArgs
    tenantOutlets?: boolean | TenantCountOutputTypeCountTenantOutletsArgs
    deviceAllocations?: boolean | TenantCountOutputTypeCountDeviceAllocationsArgs
    warehouses?: boolean | TenantCountOutputTypeCountWarehousesArgs
  }

  // Custom InputTypes
  /**
   * TenantCountOutputType without action
   */
  export type TenantCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantCountOutputType
     */
    select?: TenantCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TenantCountOutputType without action
   */
  export type TenantCountOutputTypeCountTenantUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantUserWhereInput
  }

  /**
   * TenantCountOutputType without action
   */
  export type TenantCountOutputTypeCountSubscriptionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantSubscriptionWhereInput
  }

  /**
   * TenantCountOutputType without action
   */
  export type TenantCountOutputTypeCountTenantOutletsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantOutletWhereInput
  }

  /**
   * TenantCountOutputType without action
   */
  export type TenantCountOutputTypeCountDeviceAllocationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PushyDeviceAllocationWhereInput
  }

  /**
   * TenantCountOutputType without action
   */
  export type TenantCountOutputTypeCountWarehousesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantWarehouseWhereInput
  }


  /**
   * Count Type TenantSubscriptionCountOutputType
   */

  export type TenantSubscriptionCountOutputType = {
    subscriptionAddOn: number
    deviceAllocations: number
  }

  export type TenantSubscriptionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscriptionAddOn?: boolean | TenantSubscriptionCountOutputTypeCountSubscriptionAddOnArgs
    deviceAllocations?: boolean | TenantSubscriptionCountOutputTypeCountDeviceAllocationsArgs
  }

  // Custom InputTypes
  /**
   * TenantSubscriptionCountOutputType without action
   */
  export type TenantSubscriptionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionCountOutputType
     */
    select?: TenantSubscriptionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TenantSubscriptionCountOutputType without action
   */
  export type TenantSubscriptionCountOutputTypeCountSubscriptionAddOnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantSubscriptionAddOnWhereInput
  }

  /**
   * TenantSubscriptionCountOutputType without action
   */
  export type TenantSubscriptionCountOutputTypeCountDeviceAllocationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PushyDeviceAllocationWhereInput
  }


  /**
   * Count Type TenantOutletCountOutputType
   */

  export type TenantOutletCountOutputType = {
    subscriptions: number
  }

  export type TenantOutletCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscriptions?: boolean | TenantOutletCountOutputTypeCountSubscriptionsArgs
  }

  // Custom InputTypes
  /**
   * TenantOutletCountOutputType without action
   */
  export type TenantOutletCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutletCountOutputType
     */
    select?: TenantOutletCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TenantOutletCountOutputType without action
   */
  export type TenantOutletCountOutputTypeCountSubscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantSubscriptionWhereInput
  }


  /**
   * Count Type DiscountCountOutputType
   */

  export type DiscountCountOutputType = {
    subscriptions: number
  }

  export type DiscountCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscriptions?: boolean | DiscountCountOutputTypeCountSubscriptionsArgs
  }

  // Custom InputTypes
  /**
   * DiscountCountOutputType without action
   */
  export type DiscountCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscountCountOutputType
     */
    select?: DiscountCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * DiscountCountOutputType without action
   */
  export type DiscountCountOutputTypeCountSubscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantSubscriptionWhereInput
  }


  /**
   * Count Type TenantUserCountOutputType
   */

  export type TenantUserCountOutputType = {
    pushyDevices: number
  }

  export type TenantUserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    pushyDevices?: boolean | TenantUserCountOutputTypeCountPushyDevicesArgs
  }

  // Custom InputTypes
  /**
   * TenantUserCountOutputType without action
   */
  export type TenantUserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUserCountOutputType
     */
    select?: TenantUserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TenantUserCountOutputType without action
   */
  export type TenantUserCountOutputTypeCountPushyDevicesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PushyDeviceWhereInput
  }


  /**
   * Count Type PushyDeviceCountOutputType
   */

  export type PushyDeviceCountOutputType = {
    subscriptions: number
  }

  export type PushyDeviceCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscriptions?: boolean | PushyDeviceCountOutputTypeCountSubscriptionsArgs
  }

  // Custom InputTypes
  /**
   * PushyDeviceCountOutputType without action
   */
  export type PushyDeviceCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceCountOutputType
     */
    select?: PushyDeviceCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PushyDeviceCountOutputType without action
   */
  export type PushyDeviceCountOutputTypeCountSubscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PushySubscriptionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model SubscriptionPlan
   */

  export type AggregateSubscriptionPlan = {
    _count: SubscriptionPlanCountAggregateOutputType | null
    _avg: SubscriptionPlanAvgAggregateOutputType | null
    _sum: SubscriptionPlanSumAggregateOutputType | null
    _min: SubscriptionPlanMinAggregateOutputType | null
    _max: SubscriptionPlanMaxAggregateOutputType | null
  }

  export type SubscriptionPlanAvgAggregateOutputType = {
    id: number | null
    price: number | null
    maxTransactions: number | null
    maxProducts: number | null
    maxUsers: number | null
    maxDevices: number | null
  }

  export type SubscriptionPlanSumAggregateOutputType = {
    id: number | null
    price: number | null
    maxTransactions: number | null
    maxProducts: number | null
    maxUsers: number | null
    maxDevices: number | null
  }

  export type SubscriptionPlanMinAggregateOutputType = {
    id: number | null
    planName: string | null
    planType: string | null
    price: number | null
    maxTransactions: number | null
    maxProducts: number | null
    maxUsers: number | null
    maxDevices: number | null
    description: string | null
  }

  export type SubscriptionPlanMaxAggregateOutputType = {
    id: number | null
    planName: string | null
    planType: string | null
    price: number | null
    maxTransactions: number | null
    maxProducts: number | null
    maxUsers: number | null
    maxDevices: number | null
    description: string | null
  }

  export type SubscriptionPlanCountAggregateOutputType = {
    id: number
    planName: number
    planType: number
    price: number
    maxTransactions: number
    maxProducts: number
    maxUsers: number
    maxDevices: number
    description: number
    _all: number
  }


  export type SubscriptionPlanAvgAggregateInputType = {
    id?: true
    price?: true
    maxTransactions?: true
    maxProducts?: true
    maxUsers?: true
    maxDevices?: true
  }

  export type SubscriptionPlanSumAggregateInputType = {
    id?: true
    price?: true
    maxTransactions?: true
    maxProducts?: true
    maxUsers?: true
    maxDevices?: true
  }

  export type SubscriptionPlanMinAggregateInputType = {
    id?: true
    planName?: true
    planType?: true
    price?: true
    maxTransactions?: true
    maxProducts?: true
    maxUsers?: true
    maxDevices?: true
    description?: true
  }

  export type SubscriptionPlanMaxAggregateInputType = {
    id?: true
    planName?: true
    planType?: true
    price?: true
    maxTransactions?: true
    maxProducts?: true
    maxUsers?: true
    maxDevices?: true
    description?: true
  }

  export type SubscriptionPlanCountAggregateInputType = {
    id?: true
    planName?: true
    planType?: true
    price?: true
    maxTransactions?: true
    maxProducts?: true
    maxUsers?: true
    maxDevices?: true
    description?: true
    _all?: true
  }

  export type SubscriptionPlanAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SubscriptionPlan to aggregate.
     */
    where?: SubscriptionPlanWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionPlans to fetch.
     */
    orderBy?: SubscriptionPlanOrderByWithRelationInput | SubscriptionPlanOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SubscriptionPlanWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionPlans from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionPlans.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SubscriptionPlans
    **/
    _count?: true | SubscriptionPlanCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SubscriptionPlanAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SubscriptionPlanSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SubscriptionPlanMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SubscriptionPlanMaxAggregateInputType
  }

  export type GetSubscriptionPlanAggregateType<T extends SubscriptionPlanAggregateArgs> = {
        [P in keyof T & keyof AggregateSubscriptionPlan]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSubscriptionPlan[P]>
      : GetScalarType<T[P], AggregateSubscriptionPlan[P]>
  }




  export type SubscriptionPlanGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SubscriptionPlanWhereInput
    orderBy?: SubscriptionPlanOrderByWithAggregationInput | SubscriptionPlanOrderByWithAggregationInput[]
    by: SubscriptionPlanScalarFieldEnum[] | SubscriptionPlanScalarFieldEnum
    having?: SubscriptionPlanScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SubscriptionPlanCountAggregateInputType | true
    _avg?: SubscriptionPlanAvgAggregateInputType
    _sum?: SubscriptionPlanSumAggregateInputType
    _min?: SubscriptionPlanMinAggregateInputType
    _max?: SubscriptionPlanMaxAggregateInputType
  }

  export type SubscriptionPlanGroupByOutputType = {
    id: number
    planName: string
    planType: string
    price: number
    maxTransactions: number | null
    maxProducts: number | null
    maxUsers: number | null
    maxDevices: number | null
    description: string | null
    _count: SubscriptionPlanCountAggregateOutputType | null
    _avg: SubscriptionPlanAvgAggregateOutputType | null
    _sum: SubscriptionPlanSumAggregateOutputType | null
    _min: SubscriptionPlanMinAggregateOutputType | null
    _max: SubscriptionPlanMaxAggregateOutputType | null
  }

  type GetSubscriptionPlanGroupByPayload<T extends SubscriptionPlanGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SubscriptionPlanGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SubscriptionPlanGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SubscriptionPlanGroupByOutputType[P]>
            : GetScalarType<T[P], SubscriptionPlanGroupByOutputType[P]>
        }
      >
    >


  export type SubscriptionPlanSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    planName?: boolean
    planType?: boolean
    price?: boolean
    maxTransactions?: boolean
    maxProducts?: boolean
    maxUsers?: boolean
    maxDevices?: boolean
    description?: boolean
    subscription?: boolean | SubscriptionPlan$subscriptionArgs<ExtArgs>
    _count?: boolean | SubscriptionPlanCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["subscriptionPlan"]>



  export type SubscriptionPlanSelectScalar = {
    id?: boolean
    planName?: boolean
    planType?: boolean
    price?: boolean
    maxTransactions?: boolean
    maxProducts?: boolean
    maxUsers?: boolean
    maxDevices?: boolean
    description?: boolean
  }

  export type SubscriptionPlanOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "planName" | "planType" | "price" | "maxTransactions" | "maxProducts" | "maxUsers" | "maxDevices" | "description", ExtArgs["result"]["subscriptionPlan"]>
  export type SubscriptionPlanInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscription?: boolean | SubscriptionPlan$subscriptionArgs<ExtArgs>
    _count?: boolean | SubscriptionPlanCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $SubscriptionPlanPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SubscriptionPlan"
    objects: {
      subscription: Prisma.$TenantSubscriptionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      planName: string
      planType: string
      price: number
      maxTransactions: number | null
      maxProducts: number | null
      maxUsers: number | null
      maxDevices: number | null
      description: string | null
    }, ExtArgs["result"]["subscriptionPlan"]>
    composites: {}
  }

  type SubscriptionPlanGetPayload<S extends boolean | null | undefined | SubscriptionPlanDefaultArgs> = $Result.GetResult<Prisma.$SubscriptionPlanPayload, S>

  type SubscriptionPlanCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SubscriptionPlanFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SubscriptionPlanCountAggregateInputType | true
    }

  export interface SubscriptionPlanDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SubscriptionPlan'], meta: { name: 'SubscriptionPlan' } }
    /**
     * Find zero or one SubscriptionPlan that matches the filter.
     * @param {SubscriptionPlanFindUniqueArgs} args - Arguments to find a SubscriptionPlan
     * @example
     * // Get one SubscriptionPlan
     * const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SubscriptionPlanFindUniqueArgs>(args: SelectSubset<T, SubscriptionPlanFindUniqueArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SubscriptionPlan that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SubscriptionPlanFindUniqueOrThrowArgs} args - Arguments to find a SubscriptionPlan
     * @example
     * // Get one SubscriptionPlan
     * const subscriptionPlan = await prisma.subscriptionPlan.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SubscriptionPlanFindUniqueOrThrowArgs>(args: SelectSubset<T, SubscriptionPlanFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SubscriptionPlan that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionPlanFindFirstArgs} args - Arguments to find a SubscriptionPlan
     * @example
     * // Get one SubscriptionPlan
     * const subscriptionPlan = await prisma.subscriptionPlan.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SubscriptionPlanFindFirstArgs>(args?: SelectSubset<T, SubscriptionPlanFindFirstArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SubscriptionPlan that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionPlanFindFirstOrThrowArgs} args - Arguments to find a SubscriptionPlan
     * @example
     * // Get one SubscriptionPlan
     * const subscriptionPlan = await prisma.subscriptionPlan.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SubscriptionPlanFindFirstOrThrowArgs>(args?: SelectSubset<T, SubscriptionPlanFindFirstOrThrowArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SubscriptionPlans that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionPlanFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SubscriptionPlans
     * const subscriptionPlans = await prisma.subscriptionPlan.findMany()
     * 
     * // Get first 10 SubscriptionPlans
     * const subscriptionPlans = await prisma.subscriptionPlan.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const subscriptionPlanWithIdOnly = await prisma.subscriptionPlan.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SubscriptionPlanFindManyArgs>(args?: SelectSubset<T, SubscriptionPlanFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SubscriptionPlan.
     * @param {SubscriptionPlanCreateArgs} args - Arguments to create a SubscriptionPlan.
     * @example
     * // Create one SubscriptionPlan
     * const SubscriptionPlan = await prisma.subscriptionPlan.create({
     *   data: {
     *     // ... data to create a SubscriptionPlan
     *   }
     * })
     * 
     */
    create<T extends SubscriptionPlanCreateArgs>(args: SelectSubset<T, SubscriptionPlanCreateArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SubscriptionPlans.
     * @param {SubscriptionPlanCreateManyArgs} args - Arguments to create many SubscriptionPlans.
     * @example
     * // Create many SubscriptionPlans
     * const subscriptionPlan = await prisma.subscriptionPlan.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SubscriptionPlanCreateManyArgs>(args?: SelectSubset<T, SubscriptionPlanCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a SubscriptionPlan.
     * @param {SubscriptionPlanDeleteArgs} args - Arguments to delete one SubscriptionPlan.
     * @example
     * // Delete one SubscriptionPlan
     * const SubscriptionPlan = await prisma.subscriptionPlan.delete({
     *   where: {
     *     // ... filter to delete one SubscriptionPlan
     *   }
     * })
     * 
     */
    delete<T extends SubscriptionPlanDeleteArgs>(args: SelectSubset<T, SubscriptionPlanDeleteArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SubscriptionPlan.
     * @param {SubscriptionPlanUpdateArgs} args - Arguments to update one SubscriptionPlan.
     * @example
     * // Update one SubscriptionPlan
     * const subscriptionPlan = await prisma.subscriptionPlan.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SubscriptionPlanUpdateArgs>(args: SelectSubset<T, SubscriptionPlanUpdateArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SubscriptionPlans.
     * @param {SubscriptionPlanDeleteManyArgs} args - Arguments to filter SubscriptionPlans to delete.
     * @example
     * // Delete a few SubscriptionPlans
     * const { count } = await prisma.subscriptionPlan.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SubscriptionPlanDeleteManyArgs>(args?: SelectSubset<T, SubscriptionPlanDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SubscriptionPlans.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionPlanUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SubscriptionPlans
     * const subscriptionPlan = await prisma.subscriptionPlan.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SubscriptionPlanUpdateManyArgs>(args: SelectSubset<T, SubscriptionPlanUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one SubscriptionPlan.
     * @param {SubscriptionPlanUpsertArgs} args - Arguments to update or create a SubscriptionPlan.
     * @example
     * // Update or create a SubscriptionPlan
     * const subscriptionPlan = await prisma.subscriptionPlan.upsert({
     *   create: {
     *     // ... data to create a SubscriptionPlan
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SubscriptionPlan we want to update
     *   }
     * })
     */
    upsert<T extends SubscriptionPlanUpsertArgs>(args: SelectSubset<T, SubscriptionPlanUpsertArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SubscriptionPlans.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionPlanCountArgs} args - Arguments to filter SubscriptionPlans to count.
     * @example
     * // Count the number of SubscriptionPlans
     * const count = await prisma.subscriptionPlan.count({
     *   where: {
     *     // ... the filter for the SubscriptionPlans we want to count
     *   }
     * })
    **/
    count<T extends SubscriptionPlanCountArgs>(
      args?: Subset<T, SubscriptionPlanCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SubscriptionPlanCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SubscriptionPlan.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionPlanAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SubscriptionPlanAggregateArgs>(args: Subset<T, SubscriptionPlanAggregateArgs>): Prisma.PrismaPromise<GetSubscriptionPlanAggregateType<T>>

    /**
     * Group by SubscriptionPlan.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionPlanGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SubscriptionPlanGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SubscriptionPlanGroupByArgs['orderBy'] }
        : { orderBy?: SubscriptionPlanGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SubscriptionPlanGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSubscriptionPlanGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SubscriptionPlan model
   */
  readonly fields: SubscriptionPlanFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SubscriptionPlan.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SubscriptionPlanClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    subscription<T extends SubscriptionPlan$subscriptionArgs<ExtArgs> = {}>(args?: Subset<T, SubscriptionPlan$subscriptionArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SubscriptionPlan model
   */
  interface SubscriptionPlanFieldRefs {
    readonly id: FieldRef<"SubscriptionPlan", 'Int'>
    readonly planName: FieldRef<"SubscriptionPlan", 'String'>
    readonly planType: FieldRef<"SubscriptionPlan", 'String'>
    readonly price: FieldRef<"SubscriptionPlan", 'Float'>
    readonly maxTransactions: FieldRef<"SubscriptionPlan", 'Int'>
    readonly maxProducts: FieldRef<"SubscriptionPlan", 'Int'>
    readonly maxUsers: FieldRef<"SubscriptionPlan", 'Int'>
    readonly maxDevices: FieldRef<"SubscriptionPlan", 'Int'>
    readonly description: FieldRef<"SubscriptionPlan", 'String'>
  }
    

  // Custom InputTypes
  /**
   * SubscriptionPlan findUnique
   */
  export type SubscriptionPlanFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionPlan to fetch.
     */
    where: SubscriptionPlanWhereUniqueInput
  }

  /**
   * SubscriptionPlan findUniqueOrThrow
   */
  export type SubscriptionPlanFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionPlan to fetch.
     */
    where: SubscriptionPlanWhereUniqueInput
  }

  /**
   * SubscriptionPlan findFirst
   */
  export type SubscriptionPlanFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionPlan to fetch.
     */
    where?: SubscriptionPlanWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionPlans to fetch.
     */
    orderBy?: SubscriptionPlanOrderByWithRelationInput | SubscriptionPlanOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SubscriptionPlans.
     */
    cursor?: SubscriptionPlanWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionPlans from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionPlans.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SubscriptionPlans.
     */
    distinct?: SubscriptionPlanScalarFieldEnum | SubscriptionPlanScalarFieldEnum[]
  }

  /**
   * SubscriptionPlan findFirstOrThrow
   */
  export type SubscriptionPlanFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionPlan to fetch.
     */
    where?: SubscriptionPlanWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionPlans to fetch.
     */
    orderBy?: SubscriptionPlanOrderByWithRelationInput | SubscriptionPlanOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SubscriptionPlans.
     */
    cursor?: SubscriptionPlanWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionPlans from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionPlans.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SubscriptionPlans.
     */
    distinct?: SubscriptionPlanScalarFieldEnum | SubscriptionPlanScalarFieldEnum[]
  }

  /**
   * SubscriptionPlan findMany
   */
  export type SubscriptionPlanFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionPlans to fetch.
     */
    where?: SubscriptionPlanWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionPlans to fetch.
     */
    orderBy?: SubscriptionPlanOrderByWithRelationInput | SubscriptionPlanOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SubscriptionPlans.
     */
    cursor?: SubscriptionPlanWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionPlans from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionPlans.
     */
    skip?: number
    distinct?: SubscriptionPlanScalarFieldEnum | SubscriptionPlanScalarFieldEnum[]
  }

  /**
   * SubscriptionPlan create
   */
  export type SubscriptionPlanCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * The data needed to create a SubscriptionPlan.
     */
    data: XOR<SubscriptionPlanCreateInput, SubscriptionPlanUncheckedCreateInput>
  }

  /**
   * SubscriptionPlan createMany
   */
  export type SubscriptionPlanCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SubscriptionPlans.
     */
    data: SubscriptionPlanCreateManyInput | SubscriptionPlanCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SubscriptionPlan update
   */
  export type SubscriptionPlanUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * The data needed to update a SubscriptionPlan.
     */
    data: XOR<SubscriptionPlanUpdateInput, SubscriptionPlanUncheckedUpdateInput>
    /**
     * Choose, which SubscriptionPlan to update.
     */
    where: SubscriptionPlanWhereUniqueInput
  }

  /**
   * SubscriptionPlan updateMany
   */
  export type SubscriptionPlanUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SubscriptionPlans.
     */
    data: XOR<SubscriptionPlanUpdateManyMutationInput, SubscriptionPlanUncheckedUpdateManyInput>
    /**
     * Filter which SubscriptionPlans to update
     */
    where?: SubscriptionPlanWhereInput
    /**
     * Limit how many SubscriptionPlans to update.
     */
    limit?: number
  }

  /**
   * SubscriptionPlan upsert
   */
  export type SubscriptionPlanUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * The filter to search for the SubscriptionPlan to update in case it exists.
     */
    where: SubscriptionPlanWhereUniqueInput
    /**
     * In case the SubscriptionPlan found by the `where` argument doesn't exist, create a new SubscriptionPlan with this data.
     */
    create: XOR<SubscriptionPlanCreateInput, SubscriptionPlanUncheckedCreateInput>
    /**
     * In case the SubscriptionPlan was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SubscriptionPlanUpdateInput, SubscriptionPlanUncheckedUpdateInput>
  }

  /**
   * SubscriptionPlan delete
   */
  export type SubscriptionPlanDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
    /**
     * Filter which SubscriptionPlan to delete.
     */
    where: SubscriptionPlanWhereUniqueInput
  }

  /**
   * SubscriptionPlan deleteMany
   */
  export type SubscriptionPlanDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SubscriptionPlans to delete
     */
    where?: SubscriptionPlanWhereInput
    /**
     * Limit how many SubscriptionPlans to delete.
     */
    limit?: number
  }

  /**
   * SubscriptionPlan.subscription
   */
  export type SubscriptionPlan$subscriptionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    where?: TenantSubscriptionWhereInput
    orderBy?: TenantSubscriptionOrderByWithRelationInput | TenantSubscriptionOrderByWithRelationInput[]
    cursor?: TenantSubscriptionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantSubscriptionScalarFieldEnum | TenantSubscriptionScalarFieldEnum[]
  }

  /**
   * SubscriptionPlan without action
   */
  export type SubscriptionPlanDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionPlan
     */
    select?: SubscriptionPlanSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionPlan
     */
    omit?: SubscriptionPlanOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionPlanInclude<ExtArgs> | null
  }


  /**
   * Model SubscriptionAddOn
   */

  export type AggregateSubscriptionAddOn = {
    _count: SubscriptionAddOnCountAggregateOutputType | null
    _avg: SubscriptionAddOnAvgAggregateOutputType | null
    _sum: SubscriptionAddOnSumAggregateOutputType | null
    _min: SubscriptionAddOnMinAggregateOutputType | null
    _max: SubscriptionAddOnMaxAggregateOutputType | null
  }

  export type SubscriptionAddOnAvgAggregateOutputType = {
    id: number | null
    pricePerUnit: number | null
    maxQuantity: number | null
  }

  export type SubscriptionAddOnSumAggregateOutputType = {
    id: number | null
    pricePerUnit: number | null
    maxQuantity: number | null
  }

  export type SubscriptionAddOnMinAggregateOutputType = {
    id: number | null
    name: string | null
    addOnType: string | null
    pricePerUnit: number | null
    maxQuantity: number | null
    scope: string | null
    description: string | null
  }

  export type SubscriptionAddOnMaxAggregateOutputType = {
    id: number | null
    name: string | null
    addOnType: string | null
    pricePerUnit: number | null
    maxQuantity: number | null
    scope: string | null
    description: string | null
  }

  export type SubscriptionAddOnCountAggregateOutputType = {
    id: number
    name: number
    addOnType: number
    pricePerUnit: number
    maxQuantity: number
    scope: number
    description: number
    _all: number
  }


  export type SubscriptionAddOnAvgAggregateInputType = {
    id?: true
    pricePerUnit?: true
    maxQuantity?: true
  }

  export type SubscriptionAddOnSumAggregateInputType = {
    id?: true
    pricePerUnit?: true
    maxQuantity?: true
  }

  export type SubscriptionAddOnMinAggregateInputType = {
    id?: true
    name?: true
    addOnType?: true
    pricePerUnit?: true
    maxQuantity?: true
    scope?: true
    description?: true
  }

  export type SubscriptionAddOnMaxAggregateInputType = {
    id?: true
    name?: true
    addOnType?: true
    pricePerUnit?: true
    maxQuantity?: true
    scope?: true
    description?: true
  }

  export type SubscriptionAddOnCountAggregateInputType = {
    id?: true
    name?: true
    addOnType?: true
    pricePerUnit?: true
    maxQuantity?: true
    scope?: true
    description?: true
    _all?: true
  }

  export type SubscriptionAddOnAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SubscriptionAddOn to aggregate.
     */
    where?: SubscriptionAddOnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionAddOns to fetch.
     */
    orderBy?: SubscriptionAddOnOrderByWithRelationInput | SubscriptionAddOnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SubscriptionAddOnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionAddOns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionAddOns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SubscriptionAddOns
    **/
    _count?: true | SubscriptionAddOnCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SubscriptionAddOnAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SubscriptionAddOnSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SubscriptionAddOnMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SubscriptionAddOnMaxAggregateInputType
  }

  export type GetSubscriptionAddOnAggregateType<T extends SubscriptionAddOnAggregateArgs> = {
        [P in keyof T & keyof AggregateSubscriptionAddOn]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSubscriptionAddOn[P]>
      : GetScalarType<T[P], AggregateSubscriptionAddOn[P]>
  }




  export type SubscriptionAddOnGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SubscriptionAddOnWhereInput
    orderBy?: SubscriptionAddOnOrderByWithAggregationInput | SubscriptionAddOnOrderByWithAggregationInput[]
    by: SubscriptionAddOnScalarFieldEnum[] | SubscriptionAddOnScalarFieldEnum
    having?: SubscriptionAddOnScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SubscriptionAddOnCountAggregateInputType | true
    _avg?: SubscriptionAddOnAvgAggregateInputType
    _sum?: SubscriptionAddOnSumAggregateInputType
    _min?: SubscriptionAddOnMinAggregateInputType
    _max?: SubscriptionAddOnMaxAggregateInputType
  }

  export type SubscriptionAddOnGroupByOutputType = {
    id: number
    name: string
    addOnType: string
    pricePerUnit: number
    maxQuantity: number | null
    scope: string
    description: string | null
    _count: SubscriptionAddOnCountAggregateOutputType | null
    _avg: SubscriptionAddOnAvgAggregateOutputType | null
    _sum: SubscriptionAddOnSumAggregateOutputType | null
    _min: SubscriptionAddOnMinAggregateOutputType | null
    _max: SubscriptionAddOnMaxAggregateOutputType | null
  }

  type GetSubscriptionAddOnGroupByPayload<T extends SubscriptionAddOnGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SubscriptionAddOnGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SubscriptionAddOnGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SubscriptionAddOnGroupByOutputType[P]>
            : GetScalarType<T[P], SubscriptionAddOnGroupByOutputType[P]>
        }
      >
    >


  export type SubscriptionAddOnSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    addOnType?: boolean
    pricePerUnit?: boolean
    maxQuantity?: boolean
    scope?: boolean
    description?: boolean
    subscriptions?: boolean | SubscriptionAddOn$subscriptionsArgs<ExtArgs>
    _count?: boolean | SubscriptionAddOnCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["subscriptionAddOn"]>



  export type SubscriptionAddOnSelectScalar = {
    id?: boolean
    name?: boolean
    addOnType?: boolean
    pricePerUnit?: boolean
    maxQuantity?: boolean
    scope?: boolean
    description?: boolean
  }

  export type SubscriptionAddOnOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "addOnType" | "pricePerUnit" | "maxQuantity" | "scope" | "description", ExtArgs["result"]["subscriptionAddOn"]>
  export type SubscriptionAddOnInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscriptions?: boolean | SubscriptionAddOn$subscriptionsArgs<ExtArgs>
    _count?: boolean | SubscriptionAddOnCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $SubscriptionAddOnPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SubscriptionAddOn"
    objects: {
      subscriptions: Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      name: string
      addOnType: string
      pricePerUnit: number
      maxQuantity: number | null
      scope: string
      description: string | null
    }, ExtArgs["result"]["subscriptionAddOn"]>
    composites: {}
  }

  type SubscriptionAddOnGetPayload<S extends boolean | null | undefined | SubscriptionAddOnDefaultArgs> = $Result.GetResult<Prisma.$SubscriptionAddOnPayload, S>

  type SubscriptionAddOnCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SubscriptionAddOnFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SubscriptionAddOnCountAggregateInputType | true
    }

  export interface SubscriptionAddOnDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SubscriptionAddOn'], meta: { name: 'SubscriptionAddOn' } }
    /**
     * Find zero or one SubscriptionAddOn that matches the filter.
     * @param {SubscriptionAddOnFindUniqueArgs} args - Arguments to find a SubscriptionAddOn
     * @example
     * // Get one SubscriptionAddOn
     * const subscriptionAddOn = await prisma.subscriptionAddOn.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SubscriptionAddOnFindUniqueArgs>(args: SelectSubset<T, SubscriptionAddOnFindUniqueArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SubscriptionAddOn that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SubscriptionAddOnFindUniqueOrThrowArgs} args - Arguments to find a SubscriptionAddOn
     * @example
     * // Get one SubscriptionAddOn
     * const subscriptionAddOn = await prisma.subscriptionAddOn.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SubscriptionAddOnFindUniqueOrThrowArgs>(args: SelectSubset<T, SubscriptionAddOnFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SubscriptionAddOn that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionAddOnFindFirstArgs} args - Arguments to find a SubscriptionAddOn
     * @example
     * // Get one SubscriptionAddOn
     * const subscriptionAddOn = await prisma.subscriptionAddOn.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SubscriptionAddOnFindFirstArgs>(args?: SelectSubset<T, SubscriptionAddOnFindFirstArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SubscriptionAddOn that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionAddOnFindFirstOrThrowArgs} args - Arguments to find a SubscriptionAddOn
     * @example
     * // Get one SubscriptionAddOn
     * const subscriptionAddOn = await prisma.subscriptionAddOn.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SubscriptionAddOnFindFirstOrThrowArgs>(args?: SelectSubset<T, SubscriptionAddOnFindFirstOrThrowArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SubscriptionAddOns that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionAddOnFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SubscriptionAddOns
     * const subscriptionAddOns = await prisma.subscriptionAddOn.findMany()
     * 
     * // Get first 10 SubscriptionAddOns
     * const subscriptionAddOns = await prisma.subscriptionAddOn.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const subscriptionAddOnWithIdOnly = await prisma.subscriptionAddOn.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SubscriptionAddOnFindManyArgs>(args?: SelectSubset<T, SubscriptionAddOnFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SubscriptionAddOn.
     * @param {SubscriptionAddOnCreateArgs} args - Arguments to create a SubscriptionAddOn.
     * @example
     * // Create one SubscriptionAddOn
     * const SubscriptionAddOn = await prisma.subscriptionAddOn.create({
     *   data: {
     *     // ... data to create a SubscriptionAddOn
     *   }
     * })
     * 
     */
    create<T extends SubscriptionAddOnCreateArgs>(args: SelectSubset<T, SubscriptionAddOnCreateArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SubscriptionAddOns.
     * @param {SubscriptionAddOnCreateManyArgs} args - Arguments to create many SubscriptionAddOns.
     * @example
     * // Create many SubscriptionAddOns
     * const subscriptionAddOn = await prisma.subscriptionAddOn.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SubscriptionAddOnCreateManyArgs>(args?: SelectSubset<T, SubscriptionAddOnCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a SubscriptionAddOn.
     * @param {SubscriptionAddOnDeleteArgs} args - Arguments to delete one SubscriptionAddOn.
     * @example
     * // Delete one SubscriptionAddOn
     * const SubscriptionAddOn = await prisma.subscriptionAddOn.delete({
     *   where: {
     *     // ... filter to delete one SubscriptionAddOn
     *   }
     * })
     * 
     */
    delete<T extends SubscriptionAddOnDeleteArgs>(args: SelectSubset<T, SubscriptionAddOnDeleteArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SubscriptionAddOn.
     * @param {SubscriptionAddOnUpdateArgs} args - Arguments to update one SubscriptionAddOn.
     * @example
     * // Update one SubscriptionAddOn
     * const subscriptionAddOn = await prisma.subscriptionAddOn.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SubscriptionAddOnUpdateArgs>(args: SelectSubset<T, SubscriptionAddOnUpdateArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SubscriptionAddOns.
     * @param {SubscriptionAddOnDeleteManyArgs} args - Arguments to filter SubscriptionAddOns to delete.
     * @example
     * // Delete a few SubscriptionAddOns
     * const { count } = await prisma.subscriptionAddOn.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SubscriptionAddOnDeleteManyArgs>(args?: SelectSubset<T, SubscriptionAddOnDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SubscriptionAddOns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionAddOnUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SubscriptionAddOns
     * const subscriptionAddOn = await prisma.subscriptionAddOn.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SubscriptionAddOnUpdateManyArgs>(args: SelectSubset<T, SubscriptionAddOnUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one SubscriptionAddOn.
     * @param {SubscriptionAddOnUpsertArgs} args - Arguments to update or create a SubscriptionAddOn.
     * @example
     * // Update or create a SubscriptionAddOn
     * const subscriptionAddOn = await prisma.subscriptionAddOn.upsert({
     *   create: {
     *     // ... data to create a SubscriptionAddOn
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SubscriptionAddOn we want to update
     *   }
     * })
     */
    upsert<T extends SubscriptionAddOnUpsertArgs>(args: SelectSubset<T, SubscriptionAddOnUpsertArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SubscriptionAddOns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionAddOnCountArgs} args - Arguments to filter SubscriptionAddOns to count.
     * @example
     * // Count the number of SubscriptionAddOns
     * const count = await prisma.subscriptionAddOn.count({
     *   where: {
     *     // ... the filter for the SubscriptionAddOns we want to count
     *   }
     * })
    **/
    count<T extends SubscriptionAddOnCountArgs>(
      args?: Subset<T, SubscriptionAddOnCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SubscriptionAddOnCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SubscriptionAddOn.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionAddOnAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SubscriptionAddOnAggregateArgs>(args: Subset<T, SubscriptionAddOnAggregateArgs>): Prisma.PrismaPromise<GetSubscriptionAddOnAggregateType<T>>

    /**
     * Group by SubscriptionAddOn.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionAddOnGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SubscriptionAddOnGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SubscriptionAddOnGroupByArgs['orderBy'] }
        : { orderBy?: SubscriptionAddOnGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SubscriptionAddOnGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSubscriptionAddOnGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SubscriptionAddOn model
   */
  readonly fields: SubscriptionAddOnFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SubscriptionAddOn.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SubscriptionAddOnClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    subscriptions<T extends SubscriptionAddOn$subscriptionsArgs<ExtArgs> = {}>(args?: Subset<T, SubscriptionAddOn$subscriptionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SubscriptionAddOn model
   */
  interface SubscriptionAddOnFieldRefs {
    readonly id: FieldRef<"SubscriptionAddOn", 'Int'>
    readonly name: FieldRef<"SubscriptionAddOn", 'String'>
    readonly addOnType: FieldRef<"SubscriptionAddOn", 'String'>
    readonly pricePerUnit: FieldRef<"SubscriptionAddOn", 'Float'>
    readonly maxQuantity: FieldRef<"SubscriptionAddOn", 'Int'>
    readonly scope: FieldRef<"SubscriptionAddOn", 'String'>
    readonly description: FieldRef<"SubscriptionAddOn", 'String'>
  }
    

  // Custom InputTypes
  /**
   * SubscriptionAddOn findUnique
   */
  export type SubscriptionAddOnFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionAddOn to fetch.
     */
    where: SubscriptionAddOnWhereUniqueInput
  }

  /**
   * SubscriptionAddOn findUniqueOrThrow
   */
  export type SubscriptionAddOnFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionAddOn to fetch.
     */
    where: SubscriptionAddOnWhereUniqueInput
  }

  /**
   * SubscriptionAddOn findFirst
   */
  export type SubscriptionAddOnFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionAddOn to fetch.
     */
    where?: SubscriptionAddOnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionAddOns to fetch.
     */
    orderBy?: SubscriptionAddOnOrderByWithRelationInput | SubscriptionAddOnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SubscriptionAddOns.
     */
    cursor?: SubscriptionAddOnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionAddOns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionAddOns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SubscriptionAddOns.
     */
    distinct?: SubscriptionAddOnScalarFieldEnum | SubscriptionAddOnScalarFieldEnum[]
  }

  /**
   * SubscriptionAddOn findFirstOrThrow
   */
  export type SubscriptionAddOnFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionAddOn to fetch.
     */
    where?: SubscriptionAddOnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionAddOns to fetch.
     */
    orderBy?: SubscriptionAddOnOrderByWithRelationInput | SubscriptionAddOnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SubscriptionAddOns.
     */
    cursor?: SubscriptionAddOnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionAddOns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionAddOns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SubscriptionAddOns.
     */
    distinct?: SubscriptionAddOnScalarFieldEnum | SubscriptionAddOnScalarFieldEnum[]
  }

  /**
   * SubscriptionAddOn findMany
   */
  export type SubscriptionAddOnFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionAddOns to fetch.
     */
    where?: SubscriptionAddOnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionAddOns to fetch.
     */
    orderBy?: SubscriptionAddOnOrderByWithRelationInput | SubscriptionAddOnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SubscriptionAddOns.
     */
    cursor?: SubscriptionAddOnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionAddOns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionAddOns.
     */
    skip?: number
    distinct?: SubscriptionAddOnScalarFieldEnum | SubscriptionAddOnScalarFieldEnum[]
  }

  /**
   * SubscriptionAddOn create
   */
  export type SubscriptionAddOnCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * The data needed to create a SubscriptionAddOn.
     */
    data: XOR<SubscriptionAddOnCreateInput, SubscriptionAddOnUncheckedCreateInput>
  }

  /**
   * SubscriptionAddOn createMany
   */
  export type SubscriptionAddOnCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SubscriptionAddOns.
     */
    data: SubscriptionAddOnCreateManyInput | SubscriptionAddOnCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SubscriptionAddOn update
   */
  export type SubscriptionAddOnUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * The data needed to update a SubscriptionAddOn.
     */
    data: XOR<SubscriptionAddOnUpdateInput, SubscriptionAddOnUncheckedUpdateInput>
    /**
     * Choose, which SubscriptionAddOn to update.
     */
    where: SubscriptionAddOnWhereUniqueInput
  }

  /**
   * SubscriptionAddOn updateMany
   */
  export type SubscriptionAddOnUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SubscriptionAddOns.
     */
    data: XOR<SubscriptionAddOnUpdateManyMutationInput, SubscriptionAddOnUncheckedUpdateManyInput>
    /**
     * Filter which SubscriptionAddOns to update
     */
    where?: SubscriptionAddOnWhereInput
    /**
     * Limit how many SubscriptionAddOns to update.
     */
    limit?: number
  }

  /**
   * SubscriptionAddOn upsert
   */
  export type SubscriptionAddOnUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * The filter to search for the SubscriptionAddOn to update in case it exists.
     */
    where: SubscriptionAddOnWhereUniqueInput
    /**
     * In case the SubscriptionAddOn found by the `where` argument doesn't exist, create a new SubscriptionAddOn with this data.
     */
    create: XOR<SubscriptionAddOnCreateInput, SubscriptionAddOnUncheckedCreateInput>
    /**
     * In case the SubscriptionAddOn was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SubscriptionAddOnUpdateInput, SubscriptionAddOnUncheckedUpdateInput>
  }

  /**
   * SubscriptionAddOn delete
   */
  export type SubscriptionAddOnDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter which SubscriptionAddOn to delete.
     */
    where: SubscriptionAddOnWhereUniqueInput
  }

  /**
   * SubscriptionAddOn deleteMany
   */
  export type SubscriptionAddOnDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SubscriptionAddOns to delete
     */
    where?: SubscriptionAddOnWhereInput
    /**
     * Limit how many SubscriptionAddOns to delete.
     */
    limit?: number
  }

  /**
   * SubscriptionAddOn.subscriptions
   */
  export type SubscriptionAddOn$subscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    where?: TenantSubscriptionAddOnWhereInput
    orderBy?: TenantSubscriptionAddOnOrderByWithRelationInput | TenantSubscriptionAddOnOrderByWithRelationInput[]
    cursor?: TenantSubscriptionAddOnWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantSubscriptionAddOnScalarFieldEnum | TenantSubscriptionAddOnScalarFieldEnum[]
  }

  /**
   * SubscriptionAddOn without action
   */
  export type SubscriptionAddOnDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionAddOn
     */
    select?: SubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionAddOn
     */
    omit?: SubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionAddOnInclude<ExtArgs> | null
  }


  /**
   * Model Tenant
   */

  export type AggregateTenant = {
    _count: TenantCountAggregateOutputType | null
    _avg: TenantAvgAggregateOutputType | null
    _sum: TenantSumAggregateOutputType | null
    _min: TenantMinAggregateOutputType | null
    _max: TenantMaxAggregateOutputType | null
  }

  export type TenantAvgAggregateOutputType = {
    id: number | null
  }

  export type TenantSumAggregateOutputType = {
    id: number | null
  }

  export type TenantMinAggregateOutputType = {
    id: number | null
    tenantName: string | null
    databaseName: string | null
    phoneNumber: string | null
    createdAt: Date | null
  }

  export type TenantMaxAggregateOutputType = {
    id: number | null
    tenantName: string | null
    databaseName: string | null
    phoneNumber: string | null
    createdAt: Date | null
  }

  export type TenantCountAggregateOutputType = {
    id: number
    tenantName: number
    databaseName: number
    phoneNumber: number
    createdAt: number
    _all: number
  }


  export type TenantAvgAggregateInputType = {
    id?: true
  }

  export type TenantSumAggregateInputType = {
    id?: true
  }

  export type TenantMinAggregateInputType = {
    id?: true
    tenantName?: true
    databaseName?: true
    phoneNumber?: true
    createdAt?: true
  }

  export type TenantMaxAggregateInputType = {
    id?: true
    tenantName?: true
    databaseName?: true
    phoneNumber?: true
    createdAt?: true
  }

  export type TenantCountAggregateInputType = {
    id?: true
    tenantName?: true
    databaseName?: true
    phoneNumber?: true
    createdAt?: true
    _all?: true
  }

  export type TenantAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Tenant to aggregate.
     */
    where?: TenantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TenantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tenants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Tenants
    **/
    _count?: true | TenantCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TenantAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TenantSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TenantMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TenantMaxAggregateInputType
  }

  export type GetTenantAggregateType<T extends TenantAggregateArgs> = {
        [P in keyof T & keyof AggregateTenant]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTenant[P]>
      : GetScalarType<T[P], AggregateTenant[P]>
  }




  export type TenantGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantWhereInput
    orderBy?: TenantOrderByWithAggregationInput | TenantOrderByWithAggregationInput[]
    by: TenantScalarFieldEnum[] | TenantScalarFieldEnum
    having?: TenantScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TenantCountAggregateInputType | true
    _avg?: TenantAvgAggregateInputType
    _sum?: TenantSumAggregateInputType
    _min?: TenantMinAggregateInputType
    _max?: TenantMaxAggregateInputType
  }

  export type TenantGroupByOutputType = {
    id: number
    tenantName: string
    databaseName: string | null
    phoneNumber: string | null
    createdAt: Date
    _count: TenantCountAggregateOutputType | null
    _avg: TenantAvgAggregateOutputType | null
    _sum: TenantSumAggregateOutputType | null
    _min: TenantMinAggregateOutputType | null
    _max: TenantMaxAggregateOutputType | null
  }

  type GetTenantGroupByPayload<T extends TenantGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TenantGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TenantGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TenantGroupByOutputType[P]>
            : GetScalarType<T[P], TenantGroupByOutputType[P]>
        }
      >
    >


  export type TenantSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantName?: boolean
    databaseName?: boolean
    phoneNumber?: boolean
    createdAt?: boolean
    tenantUsers?: boolean | Tenant$tenantUsersArgs<ExtArgs>
    subscription?: boolean | Tenant$subscriptionArgs<ExtArgs>
    tenantOutlets?: boolean | Tenant$tenantOutletsArgs<ExtArgs>
    deviceAllocations?: boolean | Tenant$deviceAllocationsArgs<ExtArgs>
    warehouses?: boolean | Tenant$warehousesArgs<ExtArgs>
    _count?: boolean | TenantCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tenant"]>



  export type TenantSelectScalar = {
    id?: boolean
    tenantName?: boolean
    databaseName?: boolean
    phoneNumber?: boolean
    createdAt?: boolean
  }

  export type TenantOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "tenantName" | "databaseName" | "phoneNumber" | "createdAt", ExtArgs["result"]["tenant"]>
  export type TenantInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    tenantUsers?: boolean | Tenant$tenantUsersArgs<ExtArgs>
    subscription?: boolean | Tenant$subscriptionArgs<ExtArgs>
    tenantOutlets?: boolean | Tenant$tenantOutletsArgs<ExtArgs>
    deviceAllocations?: boolean | Tenant$deviceAllocationsArgs<ExtArgs>
    warehouses?: boolean | Tenant$warehousesArgs<ExtArgs>
    _count?: boolean | TenantCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $TenantPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Tenant"
    objects: {
      tenantUsers: Prisma.$TenantUserPayload<ExtArgs>[]
      subscription: Prisma.$TenantSubscriptionPayload<ExtArgs>[]
      tenantOutlets: Prisma.$TenantOutletPayload<ExtArgs>[]
      deviceAllocations: Prisma.$PushyDeviceAllocationPayload<ExtArgs>[]
      warehouses: Prisma.$TenantWarehousePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      tenantName: string
      databaseName: string | null
      phoneNumber: string | null
      createdAt: Date
    }, ExtArgs["result"]["tenant"]>
    composites: {}
  }

  type TenantGetPayload<S extends boolean | null | undefined | TenantDefaultArgs> = $Result.GetResult<Prisma.$TenantPayload, S>

  type TenantCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TenantFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TenantCountAggregateInputType | true
    }

  export interface TenantDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Tenant'], meta: { name: 'Tenant' } }
    /**
     * Find zero or one Tenant that matches the filter.
     * @param {TenantFindUniqueArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TenantFindUniqueArgs>(args: SelectSubset<T, TenantFindUniqueArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Tenant that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TenantFindUniqueOrThrowArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TenantFindUniqueOrThrowArgs>(args: SelectSubset<T, TenantFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Tenant that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindFirstArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TenantFindFirstArgs>(args?: SelectSubset<T, TenantFindFirstArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Tenant that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindFirstOrThrowArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TenantFindFirstOrThrowArgs>(args?: SelectSubset<T, TenantFindFirstOrThrowArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Tenants that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Tenants
     * const tenants = await prisma.tenant.findMany()
     * 
     * // Get first 10 Tenants
     * const tenants = await prisma.tenant.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tenantWithIdOnly = await prisma.tenant.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TenantFindManyArgs>(args?: SelectSubset<T, TenantFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Tenant.
     * @param {TenantCreateArgs} args - Arguments to create a Tenant.
     * @example
     * // Create one Tenant
     * const Tenant = await prisma.tenant.create({
     *   data: {
     *     // ... data to create a Tenant
     *   }
     * })
     * 
     */
    create<T extends TenantCreateArgs>(args: SelectSubset<T, TenantCreateArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Tenants.
     * @param {TenantCreateManyArgs} args - Arguments to create many Tenants.
     * @example
     * // Create many Tenants
     * const tenant = await prisma.tenant.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TenantCreateManyArgs>(args?: SelectSubset<T, TenantCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Tenant.
     * @param {TenantDeleteArgs} args - Arguments to delete one Tenant.
     * @example
     * // Delete one Tenant
     * const Tenant = await prisma.tenant.delete({
     *   where: {
     *     // ... filter to delete one Tenant
     *   }
     * })
     * 
     */
    delete<T extends TenantDeleteArgs>(args: SelectSubset<T, TenantDeleteArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Tenant.
     * @param {TenantUpdateArgs} args - Arguments to update one Tenant.
     * @example
     * // Update one Tenant
     * const tenant = await prisma.tenant.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TenantUpdateArgs>(args: SelectSubset<T, TenantUpdateArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Tenants.
     * @param {TenantDeleteManyArgs} args - Arguments to filter Tenants to delete.
     * @example
     * // Delete a few Tenants
     * const { count } = await prisma.tenant.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TenantDeleteManyArgs>(args?: SelectSubset<T, TenantDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Tenants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Tenants
     * const tenant = await prisma.tenant.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TenantUpdateManyArgs>(args: SelectSubset<T, TenantUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Tenant.
     * @param {TenantUpsertArgs} args - Arguments to update or create a Tenant.
     * @example
     * // Update or create a Tenant
     * const tenant = await prisma.tenant.upsert({
     *   create: {
     *     // ... data to create a Tenant
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Tenant we want to update
     *   }
     * })
     */
    upsert<T extends TenantUpsertArgs>(args: SelectSubset<T, TenantUpsertArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Tenants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantCountArgs} args - Arguments to filter Tenants to count.
     * @example
     * // Count the number of Tenants
     * const count = await prisma.tenant.count({
     *   where: {
     *     // ... the filter for the Tenants we want to count
     *   }
     * })
    **/
    count<T extends TenantCountArgs>(
      args?: Subset<T, TenantCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TenantCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Tenant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TenantAggregateArgs>(args: Subset<T, TenantAggregateArgs>): Prisma.PrismaPromise<GetTenantAggregateType<T>>

    /**
     * Group by Tenant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TenantGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TenantGroupByArgs['orderBy'] }
        : { orderBy?: TenantGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TenantGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTenantGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Tenant model
   */
  readonly fields: TenantFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Tenant.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TenantClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    tenantUsers<T extends Tenant$tenantUsersArgs<ExtArgs> = {}>(args?: Subset<T, Tenant$tenantUsersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    subscription<T extends Tenant$subscriptionArgs<ExtArgs> = {}>(args?: Subset<T, Tenant$subscriptionArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    tenantOutlets<T extends Tenant$tenantOutletsArgs<ExtArgs> = {}>(args?: Subset<T, Tenant$tenantOutletsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    deviceAllocations<T extends Tenant$deviceAllocationsArgs<ExtArgs> = {}>(args?: Subset<T, Tenant$deviceAllocationsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    warehouses<T extends Tenant$warehousesArgs<ExtArgs> = {}>(args?: Subset<T, Tenant$warehousesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Tenant model
   */
  interface TenantFieldRefs {
    readonly id: FieldRef<"Tenant", 'Int'>
    readonly tenantName: FieldRef<"Tenant", 'String'>
    readonly databaseName: FieldRef<"Tenant", 'String'>
    readonly phoneNumber: FieldRef<"Tenant", 'String'>
    readonly createdAt: FieldRef<"Tenant", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Tenant findUnique
   */
  export type TenantFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * Filter, which Tenant to fetch.
     */
    where: TenantWhereUniqueInput
  }

  /**
   * Tenant findUniqueOrThrow
   */
  export type TenantFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * Filter, which Tenant to fetch.
     */
    where: TenantWhereUniqueInput
  }

  /**
   * Tenant findFirst
   */
  export type TenantFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * Filter, which Tenant to fetch.
     */
    where?: TenantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Tenants.
     */
    cursor?: TenantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tenants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Tenants.
     */
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[]
  }

  /**
   * Tenant findFirstOrThrow
   */
  export type TenantFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * Filter, which Tenant to fetch.
     */
    where?: TenantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Tenants.
     */
    cursor?: TenantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tenants.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Tenants.
     */
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[]
  }

  /**
   * Tenant findMany
   */
  export type TenantFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * Filter, which Tenants to fetch.
     */
    where?: TenantWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Tenants.
     */
    cursor?: TenantWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tenants.
     */
    skip?: number
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[]
  }

  /**
   * Tenant create
   */
  export type TenantCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * The data needed to create a Tenant.
     */
    data: XOR<TenantCreateInput, TenantUncheckedCreateInput>
  }

  /**
   * Tenant createMany
   */
  export type TenantCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Tenants.
     */
    data: TenantCreateManyInput | TenantCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Tenant update
   */
  export type TenantUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * The data needed to update a Tenant.
     */
    data: XOR<TenantUpdateInput, TenantUncheckedUpdateInput>
    /**
     * Choose, which Tenant to update.
     */
    where: TenantWhereUniqueInput
  }

  /**
   * Tenant updateMany
   */
  export type TenantUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Tenants.
     */
    data: XOR<TenantUpdateManyMutationInput, TenantUncheckedUpdateManyInput>
    /**
     * Filter which Tenants to update
     */
    where?: TenantWhereInput
    /**
     * Limit how many Tenants to update.
     */
    limit?: number
  }

  /**
   * Tenant upsert
   */
  export type TenantUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * The filter to search for the Tenant to update in case it exists.
     */
    where: TenantWhereUniqueInput
    /**
     * In case the Tenant found by the `where` argument doesn't exist, create a new Tenant with this data.
     */
    create: XOR<TenantCreateInput, TenantUncheckedCreateInput>
    /**
     * In case the Tenant was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TenantUpdateInput, TenantUncheckedUpdateInput>
  }

  /**
   * Tenant delete
   */
  export type TenantDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    /**
     * Filter which Tenant to delete.
     */
    where: TenantWhereUniqueInput
  }

  /**
   * Tenant deleteMany
   */
  export type TenantDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Tenants to delete
     */
    where?: TenantWhereInput
    /**
     * Limit how many Tenants to delete.
     */
    limit?: number
  }

  /**
   * Tenant.tenantUsers
   */
  export type Tenant$tenantUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    where?: TenantUserWhereInput
    orderBy?: TenantUserOrderByWithRelationInput | TenantUserOrderByWithRelationInput[]
    cursor?: TenantUserWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantUserScalarFieldEnum | TenantUserScalarFieldEnum[]
  }

  /**
   * Tenant.subscription
   */
  export type Tenant$subscriptionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    where?: TenantSubscriptionWhereInput
    orderBy?: TenantSubscriptionOrderByWithRelationInput | TenantSubscriptionOrderByWithRelationInput[]
    cursor?: TenantSubscriptionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantSubscriptionScalarFieldEnum | TenantSubscriptionScalarFieldEnum[]
  }

  /**
   * Tenant.tenantOutlets
   */
  export type Tenant$tenantOutletsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    where?: TenantOutletWhereInput
    orderBy?: TenantOutletOrderByWithRelationInput | TenantOutletOrderByWithRelationInput[]
    cursor?: TenantOutletWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantOutletScalarFieldEnum | TenantOutletScalarFieldEnum[]
  }

  /**
   * Tenant.deviceAllocations
   */
  export type Tenant$deviceAllocationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    where?: PushyDeviceAllocationWhereInput
    orderBy?: PushyDeviceAllocationOrderByWithRelationInput | PushyDeviceAllocationOrderByWithRelationInput[]
    cursor?: PushyDeviceAllocationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PushyDeviceAllocationScalarFieldEnum | PushyDeviceAllocationScalarFieldEnum[]
  }

  /**
   * Tenant.warehouses
   */
  export type Tenant$warehousesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    where?: TenantWarehouseWhereInput
    orderBy?: TenantWarehouseOrderByWithRelationInput | TenantWarehouseOrderByWithRelationInput[]
    cursor?: TenantWarehouseWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantWarehouseScalarFieldEnum | TenantWarehouseScalarFieldEnum[]
  }

  /**
   * Tenant without action
   */
  export type TenantDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
  }


  /**
   * Model TenantSubscription
   */

  export type AggregateTenantSubscription = {
    _count: TenantSubscriptionCountAggregateOutputType | null
    _avg: TenantSubscriptionAvgAggregateOutputType | null
    _sum: TenantSubscriptionSumAggregateOutputType | null
    _min: TenantSubscriptionMinAggregateOutputType | null
    _max: TenantSubscriptionMaxAggregateOutputType | null
  }

  export type TenantSubscriptionAvgAggregateOutputType = {
    id: number | null
    tenantId: number | null
    outletId: number | null
    subscriptionPlanId: number | null
    discountId: number | null
  }

  export type TenantSubscriptionSumAggregateOutputType = {
    id: number | null
    tenantId: number | null
    outletId: number | null
    subscriptionPlanId: number | null
    discountId: number | null
  }

  export type TenantSubscriptionMinAggregateOutputType = {
    id: number | null
    tenantId: number | null
    outletId: number | null
    subscriptionPlanId: number | null
    status: string | null
    nextPaymentDate: Date | null
    subscriptionValidUntil: Date | null
    createdAt: Date | null
    updatedAt: Date | null
    discountId: number | null
  }

  export type TenantSubscriptionMaxAggregateOutputType = {
    id: number | null
    tenantId: number | null
    outletId: number | null
    subscriptionPlanId: number | null
    status: string | null
    nextPaymentDate: Date | null
    subscriptionValidUntil: Date | null
    createdAt: Date | null
    updatedAt: Date | null
    discountId: number | null
  }

  export type TenantSubscriptionCountAggregateOutputType = {
    id: number
    tenantId: number
    outletId: number
    subscriptionPlanId: number
    status: number
    nextPaymentDate: number
    subscriptionValidUntil: number
    createdAt: number
    updatedAt: number
    discountId: number
    _all: number
  }


  export type TenantSubscriptionAvgAggregateInputType = {
    id?: true
    tenantId?: true
    outletId?: true
    subscriptionPlanId?: true
    discountId?: true
  }

  export type TenantSubscriptionSumAggregateInputType = {
    id?: true
    tenantId?: true
    outletId?: true
    subscriptionPlanId?: true
    discountId?: true
  }

  export type TenantSubscriptionMinAggregateInputType = {
    id?: true
    tenantId?: true
    outletId?: true
    subscriptionPlanId?: true
    status?: true
    nextPaymentDate?: true
    subscriptionValidUntil?: true
    createdAt?: true
    updatedAt?: true
    discountId?: true
  }

  export type TenantSubscriptionMaxAggregateInputType = {
    id?: true
    tenantId?: true
    outletId?: true
    subscriptionPlanId?: true
    status?: true
    nextPaymentDate?: true
    subscriptionValidUntil?: true
    createdAt?: true
    updatedAt?: true
    discountId?: true
  }

  export type TenantSubscriptionCountAggregateInputType = {
    id?: true
    tenantId?: true
    outletId?: true
    subscriptionPlanId?: true
    status?: true
    nextPaymentDate?: true
    subscriptionValidUntil?: true
    createdAt?: true
    updatedAt?: true
    discountId?: true
    _all?: true
  }

  export type TenantSubscriptionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantSubscription to aggregate.
     */
    where?: TenantSubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantSubscriptions to fetch.
     */
    orderBy?: TenantSubscriptionOrderByWithRelationInput | TenantSubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TenantSubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantSubscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantSubscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TenantSubscriptions
    **/
    _count?: true | TenantSubscriptionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TenantSubscriptionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TenantSubscriptionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TenantSubscriptionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TenantSubscriptionMaxAggregateInputType
  }

  export type GetTenantSubscriptionAggregateType<T extends TenantSubscriptionAggregateArgs> = {
        [P in keyof T & keyof AggregateTenantSubscription]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTenantSubscription[P]>
      : GetScalarType<T[P], AggregateTenantSubscription[P]>
  }




  export type TenantSubscriptionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantSubscriptionWhereInput
    orderBy?: TenantSubscriptionOrderByWithAggregationInput | TenantSubscriptionOrderByWithAggregationInput[]
    by: TenantSubscriptionScalarFieldEnum[] | TenantSubscriptionScalarFieldEnum
    having?: TenantSubscriptionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TenantSubscriptionCountAggregateInputType | true
    _avg?: TenantSubscriptionAvgAggregateInputType
    _sum?: TenantSubscriptionSumAggregateInputType
    _min?: TenantSubscriptionMinAggregateInputType
    _max?: TenantSubscriptionMaxAggregateInputType
  }

  export type TenantSubscriptionGroupByOutputType = {
    id: number
    tenantId: number
    outletId: number
    subscriptionPlanId: number
    status: string
    nextPaymentDate: Date
    subscriptionValidUntil: Date
    createdAt: Date
    updatedAt: Date
    discountId: number | null
    _count: TenantSubscriptionCountAggregateOutputType | null
    _avg: TenantSubscriptionAvgAggregateOutputType | null
    _sum: TenantSubscriptionSumAggregateOutputType | null
    _min: TenantSubscriptionMinAggregateOutputType | null
    _max: TenantSubscriptionMaxAggregateOutputType | null
  }

  type GetTenantSubscriptionGroupByPayload<T extends TenantSubscriptionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TenantSubscriptionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TenantSubscriptionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TenantSubscriptionGroupByOutputType[P]>
            : GetScalarType<T[P], TenantSubscriptionGroupByOutputType[P]>
        }
      >
    >


  export type TenantSubscriptionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    outletId?: boolean
    subscriptionPlanId?: boolean
    status?: boolean
    nextPaymentDate?: boolean
    subscriptionValidUntil?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    discountId?: boolean
    outlet?: boolean | TenantOutletDefaultArgs<ExtArgs>
    discount?: boolean | TenantSubscription$discountArgs<ExtArgs>
    tenant?: boolean | TenantDefaultArgs<ExtArgs>
    subscriptionPlan?: boolean | SubscriptionPlanDefaultArgs<ExtArgs>
    subscriptionAddOn?: boolean | TenantSubscription$subscriptionAddOnArgs<ExtArgs>
    deviceAllocations?: boolean | TenantSubscription$deviceAllocationsArgs<ExtArgs>
    _count?: boolean | TenantSubscriptionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tenantSubscription"]>



  export type TenantSubscriptionSelectScalar = {
    id?: boolean
    tenantId?: boolean
    outletId?: boolean
    subscriptionPlanId?: boolean
    status?: boolean
    nextPaymentDate?: boolean
    subscriptionValidUntil?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    discountId?: boolean
  }

  export type TenantSubscriptionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "tenantId" | "outletId" | "subscriptionPlanId" | "status" | "nextPaymentDate" | "subscriptionValidUntil" | "createdAt" | "updatedAt" | "discountId", ExtArgs["result"]["tenantSubscription"]>
  export type TenantSubscriptionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    outlet?: boolean | TenantOutletDefaultArgs<ExtArgs>
    discount?: boolean | TenantSubscription$discountArgs<ExtArgs>
    tenant?: boolean | TenantDefaultArgs<ExtArgs>
    subscriptionPlan?: boolean | SubscriptionPlanDefaultArgs<ExtArgs>
    subscriptionAddOn?: boolean | TenantSubscription$subscriptionAddOnArgs<ExtArgs>
    deviceAllocations?: boolean | TenantSubscription$deviceAllocationsArgs<ExtArgs>
    _count?: boolean | TenantSubscriptionCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $TenantSubscriptionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TenantSubscription"
    objects: {
      outlet: Prisma.$TenantOutletPayload<ExtArgs>
      discount: Prisma.$DiscountPayload<ExtArgs> | null
      tenant: Prisma.$TenantPayload<ExtArgs>
      subscriptionPlan: Prisma.$SubscriptionPlanPayload<ExtArgs>
      subscriptionAddOn: Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>[]
      deviceAllocations: Prisma.$PushyDeviceAllocationPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      tenantId: number
      outletId: number
      subscriptionPlanId: number
      status: string
      nextPaymentDate: Date
      subscriptionValidUntil: Date
      createdAt: Date
      updatedAt: Date
      discountId: number | null
    }, ExtArgs["result"]["tenantSubscription"]>
    composites: {}
  }

  type TenantSubscriptionGetPayload<S extends boolean | null | undefined | TenantSubscriptionDefaultArgs> = $Result.GetResult<Prisma.$TenantSubscriptionPayload, S>

  type TenantSubscriptionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TenantSubscriptionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TenantSubscriptionCountAggregateInputType | true
    }

  export interface TenantSubscriptionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TenantSubscription'], meta: { name: 'TenantSubscription' } }
    /**
     * Find zero or one TenantSubscription that matches the filter.
     * @param {TenantSubscriptionFindUniqueArgs} args - Arguments to find a TenantSubscription
     * @example
     * // Get one TenantSubscription
     * const tenantSubscription = await prisma.tenantSubscription.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TenantSubscriptionFindUniqueArgs>(args: SelectSubset<T, TenantSubscriptionFindUniqueArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TenantSubscription that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TenantSubscriptionFindUniqueOrThrowArgs} args - Arguments to find a TenantSubscription
     * @example
     * // Get one TenantSubscription
     * const tenantSubscription = await prisma.tenantSubscription.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TenantSubscriptionFindUniqueOrThrowArgs>(args: SelectSubset<T, TenantSubscriptionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantSubscription that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionFindFirstArgs} args - Arguments to find a TenantSubscription
     * @example
     * // Get one TenantSubscription
     * const tenantSubscription = await prisma.tenantSubscription.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TenantSubscriptionFindFirstArgs>(args?: SelectSubset<T, TenantSubscriptionFindFirstArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantSubscription that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionFindFirstOrThrowArgs} args - Arguments to find a TenantSubscription
     * @example
     * // Get one TenantSubscription
     * const tenantSubscription = await prisma.tenantSubscription.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TenantSubscriptionFindFirstOrThrowArgs>(args?: SelectSubset<T, TenantSubscriptionFindFirstOrThrowArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TenantSubscriptions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TenantSubscriptions
     * const tenantSubscriptions = await prisma.tenantSubscription.findMany()
     * 
     * // Get first 10 TenantSubscriptions
     * const tenantSubscriptions = await prisma.tenantSubscription.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tenantSubscriptionWithIdOnly = await prisma.tenantSubscription.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TenantSubscriptionFindManyArgs>(args?: SelectSubset<T, TenantSubscriptionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TenantSubscription.
     * @param {TenantSubscriptionCreateArgs} args - Arguments to create a TenantSubscription.
     * @example
     * // Create one TenantSubscription
     * const TenantSubscription = await prisma.tenantSubscription.create({
     *   data: {
     *     // ... data to create a TenantSubscription
     *   }
     * })
     * 
     */
    create<T extends TenantSubscriptionCreateArgs>(args: SelectSubset<T, TenantSubscriptionCreateArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TenantSubscriptions.
     * @param {TenantSubscriptionCreateManyArgs} args - Arguments to create many TenantSubscriptions.
     * @example
     * // Create many TenantSubscriptions
     * const tenantSubscription = await prisma.tenantSubscription.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TenantSubscriptionCreateManyArgs>(args?: SelectSubset<T, TenantSubscriptionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a TenantSubscription.
     * @param {TenantSubscriptionDeleteArgs} args - Arguments to delete one TenantSubscription.
     * @example
     * // Delete one TenantSubscription
     * const TenantSubscription = await prisma.tenantSubscription.delete({
     *   where: {
     *     // ... filter to delete one TenantSubscription
     *   }
     * })
     * 
     */
    delete<T extends TenantSubscriptionDeleteArgs>(args: SelectSubset<T, TenantSubscriptionDeleteArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TenantSubscription.
     * @param {TenantSubscriptionUpdateArgs} args - Arguments to update one TenantSubscription.
     * @example
     * // Update one TenantSubscription
     * const tenantSubscription = await prisma.tenantSubscription.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TenantSubscriptionUpdateArgs>(args: SelectSubset<T, TenantSubscriptionUpdateArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TenantSubscriptions.
     * @param {TenantSubscriptionDeleteManyArgs} args - Arguments to filter TenantSubscriptions to delete.
     * @example
     * // Delete a few TenantSubscriptions
     * const { count } = await prisma.tenantSubscription.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TenantSubscriptionDeleteManyArgs>(args?: SelectSubset<T, TenantSubscriptionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TenantSubscriptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TenantSubscriptions
     * const tenantSubscription = await prisma.tenantSubscription.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TenantSubscriptionUpdateManyArgs>(args: SelectSubset<T, TenantSubscriptionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one TenantSubscription.
     * @param {TenantSubscriptionUpsertArgs} args - Arguments to update or create a TenantSubscription.
     * @example
     * // Update or create a TenantSubscription
     * const tenantSubscription = await prisma.tenantSubscription.upsert({
     *   create: {
     *     // ... data to create a TenantSubscription
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TenantSubscription we want to update
     *   }
     * })
     */
    upsert<T extends TenantSubscriptionUpsertArgs>(args: SelectSubset<T, TenantSubscriptionUpsertArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TenantSubscriptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionCountArgs} args - Arguments to filter TenantSubscriptions to count.
     * @example
     * // Count the number of TenantSubscriptions
     * const count = await prisma.tenantSubscription.count({
     *   where: {
     *     // ... the filter for the TenantSubscriptions we want to count
     *   }
     * })
    **/
    count<T extends TenantSubscriptionCountArgs>(
      args?: Subset<T, TenantSubscriptionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TenantSubscriptionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TenantSubscription.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TenantSubscriptionAggregateArgs>(args: Subset<T, TenantSubscriptionAggregateArgs>): Prisma.PrismaPromise<GetTenantSubscriptionAggregateType<T>>

    /**
     * Group by TenantSubscription.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TenantSubscriptionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TenantSubscriptionGroupByArgs['orderBy'] }
        : { orderBy?: TenantSubscriptionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TenantSubscriptionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTenantSubscriptionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TenantSubscription model
   */
  readonly fields: TenantSubscriptionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TenantSubscription.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TenantSubscriptionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    outlet<T extends TenantOutletDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TenantOutletDefaultArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    discount<T extends TenantSubscription$discountArgs<ExtArgs> = {}>(args?: Subset<T, TenantSubscription$discountArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    tenant<T extends TenantDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TenantDefaultArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    subscriptionPlan<T extends SubscriptionPlanDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SubscriptionPlanDefaultArgs<ExtArgs>>): Prisma__SubscriptionPlanClient<$Result.GetResult<Prisma.$SubscriptionPlanPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    subscriptionAddOn<T extends TenantSubscription$subscriptionAddOnArgs<ExtArgs> = {}>(args?: Subset<T, TenantSubscription$subscriptionAddOnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    deviceAllocations<T extends TenantSubscription$deviceAllocationsArgs<ExtArgs> = {}>(args?: Subset<T, TenantSubscription$deviceAllocationsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TenantSubscription model
   */
  interface TenantSubscriptionFieldRefs {
    readonly id: FieldRef<"TenantSubscription", 'Int'>
    readonly tenantId: FieldRef<"TenantSubscription", 'Int'>
    readonly outletId: FieldRef<"TenantSubscription", 'Int'>
    readonly subscriptionPlanId: FieldRef<"TenantSubscription", 'Int'>
    readonly status: FieldRef<"TenantSubscription", 'String'>
    readonly nextPaymentDate: FieldRef<"TenantSubscription", 'DateTime'>
    readonly subscriptionValidUntil: FieldRef<"TenantSubscription", 'DateTime'>
    readonly createdAt: FieldRef<"TenantSubscription", 'DateTime'>
    readonly updatedAt: FieldRef<"TenantSubscription", 'DateTime'>
    readonly discountId: FieldRef<"TenantSubscription", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * TenantSubscription findUnique
   */
  export type TenantSubscriptionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscription to fetch.
     */
    where: TenantSubscriptionWhereUniqueInput
  }

  /**
   * TenantSubscription findUniqueOrThrow
   */
  export type TenantSubscriptionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscription to fetch.
     */
    where: TenantSubscriptionWhereUniqueInput
  }

  /**
   * TenantSubscription findFirst
   */
  export type TenantSubscriptionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscription to fetch.
     */
    where?: TenantSubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantSubscriptions to fetch.
     */
    orderBy?: TenantSubscriptionOrderByWithRelationInput | TenantSubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantSubscriptions.
     */
    cursor?: TenantSubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantSubscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantSubscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantSubscriptions.
     */
    distinct?: TenantSubscriptionScalarFieldEnum | TenantSubscriptionScalarFieldEnum[]
  }

  /**
   * TenantSubscription findFirstOrThrow
   */
  export type TenantSubscriptionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscription to fetch.
     */
    where?: TenantSubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantSubscriptions to fetch.
     */
    orderBy?: TenantSubscriptionOrderByWithRelationInput | TenantSubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantSubscriptions.
     */
    cursor?: TenantSubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantSubscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantSubscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantSubscriptions.
     */
    distinct?: TenantSubscriptionScalarFieldEnum | TenantSubscriptionScalarFieldEnum[]
  }

  /**
   * TenantSubscription findMany
   */
  export type TenantSubscriptionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscriptions to fetch.
     */
    where?: TenantSubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantSubscriptions to fetch.
     */
    orderBy?: TenantSubscriptionOrderByWithRelationInput | TenantSubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TenantSubscriptions.
     */
    cursor?: TenantSubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantSubscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantSubscriptions.
     */
    skip?: number
    distinct?: TenantSubscriptionScalarFieldEnum | TenantSubscriptionScalarFieldEnum[]
  }

  /**
   * TenantSubscription create
   */
  export type TenantSubscriptionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * The data needed to create a TenantSubscription.
     */
    data: XOR<TenantSubscriptionCreateInput, TenantSubscriptionUncheckedCreateInput>
  }

  /**
   * TenantSubscription createMany
   */
  export type TenantSubscriptionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TenantSubscriptions.
     */
    data: TenantSubscriptionCreateManyInput | TenantSubscriptionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TenantSubscription update
   */
  export type TenantSubscriptionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * The data needed to update a TenantSubscription.
     */
    data: XOR<TenantSubscriptionUpdateInput, TenantSubscriptionUncheckedUpdateInput>
    /**
     * Choose, which TenantSubscription to update.
     */
    where: TenantSubscriptionWhereUniqueInput
  }

  /**
   * TenantSubscription updateMany
   */
  export type TenantSubscriptionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TenantSubscriptions.
     */
    data: XOR<TenantSubscriptionUpdateManyMutationInput, TenantSubscriptionUncheckedUpdateManyInput>
    /**
     * Filter which TenantSubscriptions to update
     */
    where?: TenantSubscriptionWhereInput
    /**
     * Limit how many TenantSubscriptions to update.
     */
    limit?: number
  }

  /**
   * TenantSubscription upsert
   */
  export type TenantSubscriptionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * The filter to search for the TenantSubscription to update in case it exists.
     */
    where: TenantSubscriptionWhereUniqueInput
    /**
     * In case the TenantSubscription found by the `where` argument doesn't exist, create a new TenantSubscription with this data.
     */
    create: XOR<TenantSubscriptionCreateInput, TenantSubscriptionUncheckedCreateInput>
    /**
     * In case the TenantSubscription was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TenantSubscriptionUpdateInput, TenantSubscriptionUncheckedUpdateInput>
  }

  /**
   * TenantSubscription delete
   */
  export type TenantSubscriptionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    /**
     * Filter which TenantSubscription to delete.
     */
    where: TenantSubscriptionWhereUniqueInput
  }

  /**
   * TenantSubscription deleteMany
   */
  export type TenantSubscriptionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantSubscriptions to delete
     */
    where?: TenantSubscriptionWhereInput
    /**
     * Limit how many TenantSubscriptions to delete.
     */
    limit?: number
  }

  /**
   * TenantSubscription.discount
   */
  export type TenantSubscription$discountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    where?: DiscountWhereInput
  }

  /**
   * TenantSubscription.subscriptionAddOn
   */
  export type TenantSubscription$subscriptionAddOnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    where?: TenantSubscriptionAddOnWhereInput
    orderBy?: TenantSubscriptionAddOnOrderByWithRelationInput | TenantSubscriptionAddOnOrderByWithRelationInput[]
    cursor?: TenantSubscriptionAddOnWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantSubscriptionAddOnScalarFieldEnum | TenantSubscriptionAddOnScalarFieldEnum[]
  }

  /**
   * TenantSubscription.deviceAllocations
   */
  export type TenantSubscription$deviceAllocationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    where?: PushyDeviceAllocationWhereInput
    orderBy?: PushyDeviceAllocationOrderByWithRelationInput | PushyDeviceAllocationOrderByWithRelationInput[]
    cursor?: PushyDeviceAllocationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PushyDeviceAllocationScalarFieldEnum | PushyDeviceAllocationScalarFieldEnum[]
  }

  /**
   * TenantSubscription without action
   */
  export type TenantSubscriptionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
  }


  /**
   * Model TenantSubscriptionAddOn
   */

  export type AggregateTenantSubscriptionAddOn = {
    _count: TenantSubscriptionAddOnCountAggregateOutputType | null
    _avg: TenantSubscriptionAddOnAvgAggregateOutputType | null
    _sum: TenantSubscriptionAddOnSumAggregateOutputType | null
    _min: TenantSubscriptionAddOnMinAggregateOutputType | null
    _max: TenantSubscriptionAddOnMaxAggregateOutputType | null
  }

  export type TenantSubscriptionAddOnAvgAggregateOutputType = {
    id: number | null
    tenantSubscriptionId: number | null
    addOnId: number | null
    quantity: number | null
  }

  export type TenantSubscriptionAddOnSumAggregateOutputType = {
    id: number | null
    tenantSubscriptionId: number | null
    addOnId: number | null
    quantity: number | null
  }

  export type TenantSubscriptionAddOnMinAggregateOutputType = {
    id: number | null
    tenantSubscriptionId: number | null
    addOnId: number | null
    quantity: number | null
  }

  export type TenantSubscriptionAddOnMaxAggregateOutputType = {
    id: number | null
    tenantSubscriptionId: number | null
    addOnId: number | null
    quantity: number | null
  }

  export type TenantSubscriptionAddOnCountAggregateOutputType = {
    id: number
    tenantSubscriptionId: number
    addOnId: number
    quantity: number
    _all: number
  }


  export type TenantSubscriptionAddOnAvgAggregateInputType = {
    id?: true
    tenantSubscriptionId?: true
    addOnId?: true
    quantity?: true
  }

  export type TenantSubscriptionAddOnSumAggregateInputType = {
    id?: true
    tenantSubscriptionId?: true
    addOnId?: true
    quantity?: true
  }

  export type TenantSubscriptionAddOnMinAggregateInputType = {
    id?: true
    tenantSubscriptionId?: true
    addOnId?: true
    quantity?: true
  }

  export type TenantSubscriptionAddOnMaxAggregateInputType = {
    id?: true
    tenantSubscriptionId?: true
    addOnId?: true
    quantity?: true
  }

  export type TenantSubscriptionAddOnCountAggregateInputType = {
    id?: true
    tenantSubscriptionId?: true
    addOnId?: true
    quantity?: true
    _all?: true
  }

  export type TenantSubscriptionAddOnAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantSubscriptionAddOn to aggregate.
     */
    where?: TenantSubscriptionAddOnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantSubscriptionAddOns to fetch.
     */
    orderBy?: TenantSubscriptionAddOnOrderByWithRelationInput | TenantSubscriptionAddOnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TenantSubscriptionAddOnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantSubscriptionAddOns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantSubscriptionAddOns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TenantSubscriptionAddOns
    **/
    _count?: true | TenantSubscriptionAddOnCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TenantSubscriptionAddOnAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TenantSubscriptionAddOnSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TenantSubscriptionAddOnMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TenantSubscriptionAddOnMaxAggregateInputType
  }

  export type GetTenantSubscriptionAddOnAggregateType<T extends TenantSubscriptionAddOnAggregateArgs> = {
        [P in keyof T & keyof AggregateTenantSubscriptionAddOn]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTenantSubscriptionAddOn[P]>
      : GetScalarType<T[P], AggregateTenantSubscriptionAddOn[P]>
  }




  export type TenantSubscriptionAddOnGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantSubscriptionAddOnWhereInput
    orderBy?: TenantSubscriptionAddOnOrderByWithAggregationInput | TenantSubscriptionAddOnOrderByWithAggregationInput[]
    by: TenantSubscriptionAddOnScalarFieldEnum[] | TenantSubscriptionAddOnScalarFieldEnum
    having?: TenantSubscriptionAddOnScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TenantSubscriptionAddOnCountAggregateInputType | true
    _avg?: TenantSubscriptionAddOnAvgAggregateInputType
    _sum?: TenantSubscriptionAddOnSumAggregateInputType
    _min?: TenantSubscriptionAddOnMinAggregateInputType
    _max?: TenantSubscriptionAddOnMaxAggregateInputType
  }

  export type TenantSubscriptionAddOnGroupByOutputType = {
    id: number
    tenantSubscriptionId: number
    addOnId: number
    quantity: number
    _count: TenantSubscriptionAddOnCountAggregateOutputType | null
    _avg: TenantSubscriptionAddOnAvgAggregateOutputType | null
    _sum: TenantSubscriptionAddOnSumAggregateOutputType | null
    _min: TenantSubscriptionAddOnMinAggregateOutputType | null
    _max: TenantSubscriptionAddOnMaxAggregateOutputType | null
  }

  type GetTenantSubscriptionAddOnGroupByPayload<T extends TenantSubscriptionAddOnGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TenantSubscriptionAddOnGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TenantSubscriptionAddOnGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TenantSubscriptionAddOnGroupByOutputType[P]>
            : GetScalarType<T[P], TenantSubscriptionAddOnGroupByOutputType[P]>
        }
      >
    >


  export type TenantSubscriptionAddOnSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantSubscriptionId?: boolean
    addOnId?: boolean
    quantity?: boolean
    tenantSubscription?: boolean | TenantSubscriptionDefaultArgs<ExtArgs>
    addOn?: boolean | SubscriptionAddOnDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tenantSubscriptionAddOn"]>



  export type TenantSubscriptionAddOnSelectScalar = {
    id?: boolean
    tenantSubscriptionId?: boolean
    addOnId?: boolean
    quantity?: boolean
  }

  export type TenantSubscriptionAddOnOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "tenantSubscriptionId" | "addOnId" | "quantity", ExtArgs["result"]["tenantSubscriptionAddOn"]>
  export type TenantSubscriptionAddOnInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    tenantSubscription?: boolean | TenantSubscriptionDefaultArgs<ExtArgs>
    addOn?: boolean | SubscriptionAddOnDefaultArgs<ExtArgs>
  }

  export type $TenantSubscriptionAddOnPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TenantSubscriptionAddOn"
    objects: {
      tenantSubscription: Prisma.$TenantSubscriptionPayload<ExtArgs>
      addOn: Prisma.$SubscriptionAddOnPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      tenantSubscriptionId: number
      addOnId: number
      quantity: number
    }, ExtArgs["result"]["tenantSubscriptionAddOn"]>
    composites: {}
  }

  type TenantSubscriptionAddOnGetPayload<S extends boolean | null | undefined | TenantSubscriptionAddOnDefaultArgs> = $Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload, S>

  type TenantSubscriptionAddOnCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TenantSubscriptionAddOnFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TenantSubscriptionAddOnCountAggregateInputType | true
    }

  export interface TenantSubscriptionAddOnDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TenantSubscriptionAddOn'], meta: { name: 'TenantSubscriptionAddOn' } }
    /**
     * Find zero or one TenantSubscriptionAddOn that matches the filter.
     * @param {TenantSubscriptionAddOnFindUniqueArgs} args - Arguments to find a TenantSubscriptionAddOn
     * @example
     * // Get one TenantSubscriptionAddOn
     * const tenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TenantSubscriptionAddOnFindUniqueArgs>(args: SelectSubset<T, TenantSubscriptionAddOnFindUniqueArgs<ExtArgs>>): Prisma__TenantSubscriptionAddOnClient<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TenantSubscriptionAddOn that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TenantSubscriptionAddOnFindUniqueOrThrowArgs} args - Arguments to find a TenantSubscriptionAddOn
     * @example
     * // Get one TenantSubscriptionAddOn
     * const tenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TenantSubscriptionAddOnFindUniqueOrThrowArgs>(args: SelectSubset<T, TenantSubscriptionAddOnFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TenantSubscriptionAddOnClient<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantSubscriptionAddOn that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionAddOnFindFirstArgs} args - Arguments to find a TenantSubscriptionAddOn
     * @example
     * // Get one TenantSubscriptionAddOn
     * const tenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TenantSubscriptionAddOnFindFirstArgs>(args?: SelectSubset<T, TenantSubscriptionAddOnFindFirstArgs<ExtArgs>>): Prisma__TenantSubscriptionAddOnClient<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantSubscriptionAddOn that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionAddOnFindFirstOrThrowArgs} args - Arguments to find a TenantSubscriptionAddOn
     * @example
     * // Get one TenantSubscriptionAddOn
     * const tenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TenantSubscriptionAddOnFindFirstOrThrowArgs>(args?: SelectSubset<T, TenantSubscriptionAddOnFindFirstOrThrowArgs<ExtArgs>>): Prisma__TenantSubscriptionAddOnClient<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TenantSubscriptionAddOns that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionAddOnFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TenantSubscriptionAddOns
     * const tenantSubscriptionAddOns = await prisma.tenantSubscriptionAddOn.findMany()
     * 
     * // Get first 10 TenantSubscriptionAddOns
     * const tenantSubscriptionAddOns = await prisma.tenantSubscriptionAddOn.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tenantSubscriptionAddOnWithIdOnly = await prisma.tenantSubscriptionAddOn.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TenantSubscriptionAddOnFindManyArgs>(args?: SelectSubset<T, TenantSubscriptionAddOnFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TenantSubscriptionAddOn.
     * @param {TenantSubscriptionAddOnCreateArgs} args - Arguments to create a TenantSubscriptionAddOn.
     * @example
     * // Create one TenantSubscriptionAddOn
     * const TenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.create({
     *   data: {
     *     // ... data to create a TenantSubscriptionAddOn
     *   }
     * })
     * 
     */
    create<T extends TenantSubscriptionAddOnCreateArgs>(args: SelectSubset<T, TenantSubscriptionAddOnCreateArgs<ExtArgs>>): Prisma__TenantSubscriptionAddOnClient<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TenantSubscriptionAddOns.
     * @param {TenantSubscriptionAddOnCreateManyArgs} args - Arguments to create many TenantSubscriptionAddOns.
     * @example
     * // Create many TenantSubscriptionAddOns
     * const tenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TenantSubscriptionAddOnCreateManyArgs>(args?: SelectSubset<T, TenantSubscriptionAddOnCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a TenantSubscriptionAddOn.
     * @param {TenantSubscriptionAddOnDeleteArgs} args - Arguments to delete one TenantSubscriptionAddOn.
     * @example
     * // Delete one TenantSubscriptionAddOn
     * const TenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.delete({
     *   where: {
     *     // ... filter to delete one TenantSubscriptionAddOn
     *   }
     * })
     * 
     */
    delete<T extends TenantSubscriptionAddOnDeleteArgs>(args: SelectSubset<T, TenantSubscriptionAddOnDeleteArgs<ExtArgs>>): Prisma__TenantSubscriptionAddOnClient<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TenantSubscriptionAddOn.
     * @param {TenantSubscriptionAddOnUpdateArgs} args - Arguments to update one TenantSubscriptionAddOn.
     * @example
     * // Update one TenantSubscriptionAddOn
     * const tenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TenantSubscriptionAddOnUpdateArgs>(args: SelectSubset<T, TenantSubscriptionAddOnUpdateArgs<ExtArgs>>): Prisma__TenantSubscriptionAddOnClient<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TenantSubscriptionAddOns.
     * @param {TenantSubscriptionAddOnDeleteManyArgs} args - Arguments to filter TenantSubscriptionAddOns to delete.
     * @example
     * // Delete a few TenantSubscriptionAddOns
     * const { count } = await prisma.tenantSubscriptionAddOn.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TenantSubscriptionAddOnDeleteManyArgs>(args?: SelectSubset<T, TenantSubscriptionAddOnDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TenantSubscriptionAddOns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionAddOnUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TenantSubscriptionAddOns
     * const tenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TenantSubscriptionAddOnUpdateManyArgs>(args: SelectSubset<T, TenantSubscriptionAddOnUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one TenantSubscriptionAddOn.
     * @param {TenantSubscriptionAddOnUpsertArgs} args - Arguments to update or create a TenantSubscriptionAddOn.
     * @example
     * // Update or create a TenantSubscriptionAddOn
     * const tenantSubscriptionAddOn = await prisma.tenantSubscriptionAddOn.upsert({
     *   create: {
     *     // ... data to create a TenantSubscriptionAddOn
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TenantSubscriptionAddOn we want to update
     *   }
     * })
     */
    upsert<T extends TenantSubscriptionAddOnUpsertArgs>(args: SelectSubset<T, TenantSubscriptionAddOnUpsertArgs<ExtArgs>>): Prisma__TenantSubscriptionAddOnClient<$Result.GetResult<Prisma.$TenantSubscriptionAddOnPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TenantSubscriptionAddOns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionAddOnCountArgs} args - Arguments to filter TenantSubscriptionAddOns to count.
     * @example
     * // Count the number of TenantSubscriptionAddOns
     * const count = await prisma.tenantSubscriptionAddOn.count({
     *   where: {
     *     // ... the filter for the TenantSubscriptionAddOns we want to count
     *   }
     * })
    **/
    count<T extends TenantSubscriptionAddOnCountArgs>(
      args?: Subset<T, TenantSubscriptionAddOnCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TenantSubscriptionAddOnCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TenantSubscriptionAddOn.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionAddOnAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TenantSubscriptionAddOnAggregateArgs>(args: Subset<T, TenantSubscriptionAddOnAggregateArgs>): Prisma.PrismaPromise<GetTenantSubscriptionAddOnAggregateType<T>>

    /**
     * Group by TenantSubscriptionAddOn.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantSubscriptionAddOnGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TenantSubscriptionAddOnGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TenantSubscriptionAddOnGroupByArgs['orderBy'] }
        : { orderBy?: TenantSubscriptionAddOnGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TenantSubscriptionAddOnGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTenantSubscriptionAddOnGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TenantSubscriptionAddOn model
   */
  readonly fields: TenantSubscriptionAddOnFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TenantSubscriptionAddOn.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TenantSubscriptionAddOnClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    tenantSubscription<T extends TenantSubscriptionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TenantSubscriptionDefaultArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    addOn<T extends SubscriptionAddOnDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SubscriptionAddOnDefaultArgs<ExtArgs>>): Prisma__SubscriptionAddOnClient<$Result.GetResult<Prisma.$SubscriptionAddOnPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TenantSubscriptionAddOn model
   */
  interface TenantSubscriptionAddOnFieldRefs {
    readonly id: FieldRef<"TenantSubscriptionAddOn", 'Int'>
    readonly tenantSubscriptionId: FieldRef<"TenantSubscriptionAddOn", 'Int'>
    readonly addOnId: FieldRef<"TenantSubscriptionAddOn", 'Int'>
    readonly quantity: FieldRef<"TenantSubscriptionAddOn", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * TenantSubscriptionAddOn findUnique
   */
  export type TenantSubscriptionAddOnFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscriptionAddOn to fetch.
     */
    where: TenantSubscriptionAddOnWhereUniqueInput
  }

  /**
   * TenantSubscriptionAddOn findUniqueOrThrow
   */
  export type TenantSubscriptionAddOnFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscriptionAddOn to fetch.
     */
    where: TenantSubscriptionAddOnWhereUniqueInput
  }

  /**
   * TenantSubscriptionAddOn findFirst
   */
  export type TenantSubscriptionAddOnFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscriptionAddOn to fetch.
     */
    where?: TenantSubscriptionAddOnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantSubscriptionAddOns to fetch.
     */
    orderBy?: TenantSubscriptionAddOnOrderByWithRelationInput | TenantSubscriptionAddOnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantSubscriptionAddOns.
     */
    cursor?: TenantSubscriptionAddOnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantSubscriptionAddOns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantSubscriptionAddOns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantSubscriptionAddOns.
     */
    distinct?: TenantSubscriptionAddOnScalarFieldEnum | TenantSubscriptionAddOnScalarFieldEnum[]
  }

  /**
   * TenantSubscriptionAddOn findFirstOrThrow
   */
  export type TenantSubscriptionAddOnFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscriptionAddOn to fetch.
     */
    where?: TenantSubscriptionAddOnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantSubscriptionAddOns to fetch.
     */
    orderBy?: TenantSubscriptionAddOnOrderByWithRelationInput | TenantSubscriptionAddOnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantSubscriptionAddOns.
     */
    cursor?: TenantSubscriptionAddOnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantSubscriptionAddOns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantSubscriptionAddOns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantSubscriptionAddOns.
     */
    distinct?: TenantSubscriptionAddOnScalarFieldEnum | TenantSubscriptionAddOnScalarFieldEnum[]
  }

  /**
   * TenantSubscriptionAddOn findMany
   */
  export type TenantSubscriptionAddOnFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter, which TenantSubscriptionAddOns to fetch.
     */
    where?: TenantSubscriptionAddOnWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantSubscriptionAddOns to fetch.
     */
    orderBy?: TenantSubscriptionAddOnOrderByWithRelationInput | TenantSubscriptionAddOnOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TenantSubscriptionAddOns.
     */
    cursor?: TenantSubscriptionAddOnWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantSubscriptionAddOns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantSubscriptionAddOns.
     */
    skip?: number
    distinct?: TenantSubscriptionAddOnScalarFieldEnum | TenantSubscriptionAddOnScalarFieldEnum[]
  }

  /**
   * TenantSubscriptionAddOn create
   */
  export type TenantSubscriptionAddOnCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * The data needed to create a TenantSubscriptionAddOn.
     */
    data: XOR<TenantSubscriptionAddOnCreateInput, TenantSubscriptionAddOnUncheckedCreateInput>
  }

  /**
   * TenantSubscriptionAddOn createMany
   */
  export type TenantSubscriptionAddOnCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TenantSubscriptionAddOns.
     */
    data: TenantSubscriptionAddOnCreateManyInput | TenantSubscriptionAddOnCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TenantSubscriptionAddOn update
   */
  export type TenantSubscriptionAddOnUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * The data needed to update a TenantSubscriptionAddOn.
     */
    data: XOR<TenantSubscriptionAddOnUpdateInput, TenantSubscriptionAddOnUncheckedUpdateInput>
    /**
     * Choose, which TenantSubscriptionAddOn to update.
     */
    where: TenantSubscriptionAddOnWhereUniqueInput
  }

  /**
   * TenantSubscriptionAddOn updateMany
   */
  export type TenantSubscriptionAddOnUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TenantSubscriptionAddOns.
     */
    data: XOR<TenantSubscriptionAddOnUpdateManyMutationInput, TenantSubscriptionAddOnUncheckedUpdateManyInput>
    /**
     * Filter which TenantSubscriptionAddOns to update
     */
    where?: TenantSubscriptionAddOnWhereInput
    /**
     * Limit how many TenantSubscriptionAddOns to update.
     */
    limit?: number
  }

  /**
   * TenantSubscriptionAddOn upsert
   */
  export type TenantSubscriptionAddOnUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * The filter to search for the TenantSubscriptionAddOn to update in case it exists.
     */
    where: TenantSubscriptionAddOnWhereUniqueInput
    /**
     * In case the TenantSubscriptionAddOn found by the `where` argument doesn't exist, create a new TenantSubscriptionAddOn with this data.
     */
    create: XOR<TenantSubscriptionAddOnCreateInput, TenantSubscriptionAddOnUncheckedCreateInput>
    /**
     * In case the TenantSubscriptionAddOn was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TenantSubscriptionAddOnUpdateInput, TenantSubscriptionAddOnUncheckedUpdateInput>
  }

  /**
   * TenantSubscriptionAddOn delete
   */
  export type TenantSubscriptionAddOnDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
    /**
     * Filter which TenantSubscriptionAddOn to delete.
     */
    where: TenantSubscriptionAddOnWhereUniqueInput
  }

  /**
   * TenantSubscriptionAddOn deleteMany
   */
  export type TenantSubscriptionAddOnDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantSubscriptionAddOns to delete
     */
    where?: TenantSubscriptionAddOnWhereInput
    /**
     * Limit how many TenantSubscriptionAddOns to delete.
     */
    limit?: number
  }

  /**
   * TenantSubscriptionAddOn without action
   */
  export type TenantSubscriptionAddOnDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscriptionAddOn
     */
    select?: TenantSubscriptionAddOnSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscriptionAddOn
     */
    omit?: TenantSubscriptionAddOnOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionAddOnInclude<ExtArgs> | null
  }


  /**
   * Model TenantOutlet
   */

  export type AggregateTenantOutlet = {
    _count: TenantOutletCountAggregateOutputType | null
    _avg: TenantOutletAvgAggregateOutputType | null
    _sum: TenantOutletSumAggregateOutputType | null
    _min: TenantOutletMinAggregateOutputType | null
    _max: TenantOutletMaxAggregateOutputType | null
  }

  export type TenantOutletAvgAggregateOutputType = {
    id: number | null
    tenantId: number | null
  }

  export type TenantOutletSumAggregateOutputType = {
    id: number | null
    tenantId: number | null
  }

  export type TenantOutletMinAggregateOutputType = {
    id: number | null
    tenantId: number | null
    outletName: string | null
    address: string | null
    createdAt: Date | null
    isActive: boolean | null
  }

  export type TenantOutletMaxAggregateOutputType = {
    id: number | null
    tenantId: number | null
    outletName: string | null
    address: string | null
    createdAt: Date | null
    isActive: boolean | null
  }

  export type TenantOutletCountAggregateOutputType = {
    id: number
    tenantId: number
    outletName: number
    address: number
    createdAt: number
    isActive: number
    _all: number
  }


  export type TenantOutletAvgAggregateInputType = {
    id?: true
    tenantId?: true
  }

  export type TenantOutletSumAggregateInputType = {
    id?: true
    tenantId?: true
  }

  export type TenantOutletMinAggregateInputType = {
    id?: true
    tenantId?: true
    outletName?: true
    address?: true
    createdAt?: true
    isActive?: true
  }

  export type TenantOutletMaxAggregateInputType = {
    id?: true
    tenantId?: true
    outletName?: true
    address?: true
    createdAt?: true
    isActive?: true
  }

  export type TenantOutletCountAggregateInputType = {
    id?: true
    tenantId?: true
    outletName?: true
    address?: true
    createdAt?: true
    isActive?: true
    _all?: true
  }

  export type TenantOutletAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantOutlet to aggregate.
     */
    where?: TenantOutletWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantOutlets to fetch.
     */
    orderBy?: TenantOutletOrderByWithRelationInput | TenantOutletOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TenantOutletWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantOutlets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantOutlets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TenantOutlets
    **/
    _count?: true | TenantOutletCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TenantOutletAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TenantOutletSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TenantOutletMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TenantOutletMaxAggregateInputType
  }

  export type GetTenantOutletAggregateType<T extends TenantOutletAggregateArgs> = {
        [P in keyof T & keyof AggregateTenantOutlet]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTenantOutlet[P]>
      : GetScalarType<T[P], AggregateTenantOutlet[P]>
  }




  export type TenantOutletGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantOutletWhereInput
    orderBy?: TenantOutletOrderByWithAggregationInput | TenantOutletOrderByWithAggregationInput[]
    by: TenantOutletScalarFieldEnum[] | TenantOutletScalarFieldEnum
    having?: TenantOutletScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TenantOutletCountAggregateInputType | true
    _avg?: TenantOutletAvgAggregateInputType
    _sum?: TenantOutletSumAggregateInputType
    _min?: TenantOutletMinAggregateInputType
    _max?: TenantOutletMaxAggregateInputType
  }

  export type TenantOutletGroupByOutputType = {
    id: number
    tenantId: number
    outletName: string
    address: string | null
    createdAt: Date
    isActive: boolean
    _count: TenantOutletCountAggregateOutputType | null
    _avg: TenantOutletAvgAggregateOutputType | null
    _sum: TenantOutletSumAggregateOutputType | null
    _min: TenantOutletMinAggregateOutputType | null
    _max: TenantOutletMaxAggregateOutputType | null
  }

  type GetTenantOutletGroupByPayload<T extends TenantOutletGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TenantOutletGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TenantOutletGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TenantOutletGroupByOutputType[P]>
            : GetScalarType<T[P], TenantOutletGroupByOutputType[P]>
        }
      >
    >


  export type TenantOutletSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    outletName?: boolean
    address?: boolean
    createdAt?: boolean
    isActive?: boolean
    tenant?: boolean | TenantDefaultArgs<ExtArgs>
    subscriptions?: boolean | TenantOutlet$subscriptionsArgs<ExtArgs>
    _count?: boolean | TenantOutletCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tenantOutlet"]>



  export type TenantOutletSelectScalar = {
    id?: boolean
    tenantId?: boolean
    outletName?: boolean
    address?: boolean
    createdAt?: boolean
    isActive?: boolean
  }

  export type TenantOutletOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "tenantId" | "outletName" | "address" | "createdAt" | "isActive", ExtArgs["result"]["tenantOutlet"]>
  export type TenantOutletInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    tenant?: boolean | TenantDefaultArgs<ExtArgs>
    subscriptions?: boolean | TenantOutlet$subscriptionsArgs<ExtArgs>
    _count?: boolean | TenantOutletCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $TenantOutletPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TenantOutlet"
    objects: {
      tenant: Prisma.$TenantPayload<ExtArgs>
      subscriptions: Prisma.$TenantSubscriptionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      tenantId: number
      outletName: string
      address: string | null
      createdAt: Date
      isActive: boolean
    }, ExtArgs["result"]["tenantOutlet"]>
    composites: {}
  }

  type TenantOutletGetPayload<S extends boolean | null | undefined | TenantOutletDefaultArgs> = $Result.GetResult<Prisma.$TenantOutletPayload, S>

  type TenantOutletCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TenantOutletFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TenantOutletCountAggregateInputType | true
    }

  export interface TenantOutletDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TenantOutlet'], meta: { name: 'TenantOutlet' } }
    /**
     * Find zero or one TenantOutlet that matches the filter.
     * @param {TenantOutletFindUniqueArgs} args - Arguments to find a TenantOutlet
     * @example
     * // Get one TenantOutlet
     * const tenantOutlet = await prisma.tenantOutlet.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TenantOutletFindUniqueArgs>(args: SelectSubset<T, TenantOutletFindUniqueArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TenantOutlet that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TenantOutletFindUniqueOrThrowArgs} args - Arguments to find a TenantOutlet
     * @example
     * // Get one TenantOutlet
     * const tenantOutlet = await prisma.tenantOutlet.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TenantOutletFindUniqueOrThrowArgs>(args: SelectSubset<T, TenantOutletFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantOutlet that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantOutletFindFirstArgs} args - Arguments to find a TenantOutlet
     * @example
     * // Get one TenantOutlet
     * const tenantOutlet = await prisma.tenantOutlet.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TenantOutletFindFirstArgs>(args?: SelectSubset<T, TenantOutletFindFirstArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantOutlet that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantOutletFindFirstOrThrowArgs} args - Arguments to find a TenantOutlet
     * @example
     * // Get one TenantOutlet
     * const tenantOutlet = await prisma.tenantOutlet.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TenantOutletFindFirstOrThrowArgs>(args?: SelectSubset<T, TenantOutletFindFirstOrThrowArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TenantOutlets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantOutletFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TenantOutlets
     * const tenantOutlets = await prisma.tenantOutlet.findMany()
     * 
     * // Get first 10 TenantOutlets
     * const tenantOutlets = await prisma.tenantOutlet.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tenantOutletWithIdOnly = await prisma.tenantOutlet.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TenantOutletFindManyArgs>(args?: SelectSubset<T, TenantOutletFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TenantOutlet.
     * @param {TenantOutletCreateArgs} args - Arguments to create a TenantOutlet.
     * @example
     * // Create one TenantOutlet
     * const TenantOutlet = await prisma.tenantOutlet.create({
     *   data: {
     *     // ... data to create a TenantOutlet
     *   }
     * })
     * 
     */
    create<T extends TenantOutletCreateArgs>(args: SelectSubset<T, TenantOutletCreateArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TenantOutlets.
     * @param {TenantOutletCreateManyArgs} args - Arguments to create many TenantOutlets.
     * @example
     * // Create many TenantOutlets
     * const tenantOutlet = await prisma.tenantOutlet.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TenantOutletCreateManyArgs>(args?: SelectSubset<T, TenantOutletCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a TenantOutlet.
     * @param {TenantOutletDeleteArgs} args - Arguments to delete one TenantOutlet.
     * @example
     * // Delete one TenantOutlet
     * const TenantOutlet = await prisma.tenantOutlet.delete({
     *   where: {
     *     // ... filter to delete one TenantOutlet
     *   }
     * })
     * 
     */
    delete<T extends TenantOutletDeleteArgs>(args: SelectSubset<T, TenantOutletDeleteArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TenantOutlet.
     * @param {TenantOutletUpdateArgs} args - Arguments to update one TenantOutlet.
     * @example
     * // Update one TenantOutlet
     * const tenantOutlet = await prisma.tenantOutlet.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TenantOutletUpdateArgs>(args: SelectSubset<T, TenantOutletUpdateArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TenantOutlets.
     * @param {TenantOutletDeleteManyArgs} args - Arguments to filter TenantOutlets to delete.
     * @example
     * // Delete a few TenantOutlets
     * const { count } = await prisma.tenantOutlet.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TenantOutletDeleteManyArgs>(args?: SelectSubset<T, TenantOutletDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TenantOutlets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantOutletUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TenantOutlets
     * const tenantOutlet = await prisma.tenantOutlet.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TenantOutletUpdateManyArgs>(args: SelectSubset<T, TenantOutletUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one TenantOutlet.
     * @param {TenantOutletUpsertArgs} args - Arguments to update or create a TenantOutlet.
     * @example
     * // Update or create a TenantOutlet
     * const tenantOutlet = await prisma.tenantOutlet.upsert({
     *   create: {
     *     // ... data to create a TenantOutlet
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TenantOutlet we want to update
     *   }
     * })
     */
    upsert<T extends TenantOutletUpsertArgs>(args: SelectSubset<T, TenantOutletUpsertArgs<ExtArgs>>): Prisma__TenantOutletClient<$Result.GetResult<Prisma.$TenantOutletPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TenantOutlets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantOutletCountArgs} args - Arguments to filter TenantOutlets to count.
     * @example
     * // Count the number of TenantOutlets
     * const count = await prisma.tenantOutlet.count({
     *   where: {
     *     // ... the filter for the TenantOutlets we want to count
     *   }
     * })
    **/
    count<T extends TenantOutletCountArgs>(
      args?: Subset<T, TenantOutletCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TenantOutletCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TenantOutlet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantOutletAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TenantOutletAggregateArgs>(args: Subset<T, TenantOutletAggregateArgs>): Prisma.PrismaPromise<GetTenantOutletAggregateType<T>>

    /**
     * Group by TenantOutlet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantOutletGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TenantOutletGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TenantOutletGroupByArgs['orderBy'] }
        : { orderBy?: TenantOutletGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TenantOutletGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTenantOutletGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TenantOutlet model
   */
  readonly fields: TenantOutletFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TenantOutlet.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TenantOutletClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    tenant<T extends TenantDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TenantDefaultArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    subscriptions<T extends TenantOutlet$subscriptionsArgs<ExtArgs> = {}>(args?: Subset<T, TenantOutlet$subscriptionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TenantOutlet model
   */
  interface TenantOutletFieldRefs {
    readonly id: FieldRef<"TenantOutlet", 'Int'>
    readonly tenantId: FieldRef<"TenantOutlet", 'Int'>
    readonly outletName: FieldRef<"TenantOutlet", 'String'>
    readonly address: FieldRef<"TenantOutlet", 'String'>
    readonly createdAt: FieldRef<"TenantOutlet", 'DateTime'>
    readonly isActive: FieldRef<"TenantOutlet", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * TenantOutlet findUnique
   */
  export type TenantOutletFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * Filter, which TenantOutlet to fetch.
     */
    where: TenantOutletWhereUniqueInput
  }

  /**
   * TenantOutlet findUniqueOrThrow
   */
  export type TenantOutletFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * Filter, which TenantOutlet to fetch.
     */
    where: TenantOutletWhereUniqueInput
  }

  /**
   * TenantOutlet findFirst
   */
  export type TenantOutletFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * Filter, which TenantOutlet to fetch.
     */
    where?: TenantOutletWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantOutlets to fetch.
     */
    orderBy?: TenantOutletOrderByWithRelationInput | TenantOutletOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantOutlets.
     */
    cursor?: TenantOutletWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantOutlets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantOutlets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantOutlets.
     */
    distinct?: TenantOutletScalarFieldEnum | TenantOutletScalarFieldEnum[]
  }

  /**
   * TenantOutlet findFirstOrThrow
   */
  export type TenantOutletFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * Filter, which TenantOutlet to fetch.
     */
    where?: TenantOutletWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantOutlets to fetch.
     */
    orderBy?: TenantOutletOrderByWithRelationInput | TenantOutletOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantOutlets.
     */
    cursor?: TenantOutletWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantOutlets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantOutlets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantOutlets.
     */
    distinct?: TenantOutletScalarFieldEnum | TenantOutletScalarFieldEnum[]
  }

  /**
   * TenantOutlet findMany
   */
  export type TenantOutletFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * Filter, which TenantOutlets to fetch.
     */
    where?: TenantOutletWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantOutlets to fetch.
     */
    orderBy?: TenantOutletOrderByWithRelationInput | TenantOutletOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TenantOutlets.
     */
    cursor?: TenantOutletWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantOutlets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantOutlets.
     */
    skip?: number
    distinct?: TenantOutletScalarFieldEnum | TenantOutletScalarFieldEnum[]
  }

  /**
   * TenantOutlet create
   */
  export type TenantOutletCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * The data needed to create a TenantOutlet.
     */
    data: XOR<TenantOutletCreateInput, TenantOutletUncheckedCreateInput>
  }

  /**
   * TenantOutlet createMany
   */
  export type TenantOutletCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TenantOutlets.
     */
    data: TenantOutletCreateManyInput | TenantOutletCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TenantOutlet update
   */
  export type TenantOutletUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * The data needed to update a TenantOutlet.
     */
    data: XOR<TenantOutletUpdateInput, TenantOutletUncheckedUpdateInput>
    /**
     * Choose, which TenantOutlet to update.
     */
    where: TenantOutletWhereUniqueInput
  }

  /**
   * TenantOutlet updateMany
   */
  export type TenantOutletUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TenantOutlets.
     */
    data: XOR<TenantOutletUpdateManyMutationInput, TenantOutletUncheckedUpdateManyInput>
    /**
     * Filter which TenantOutlets to update
     */
    where?: TenantOutletWhereInput
    /**
     * Limit how many TenantOutlets to update.
     */
    limit?: number
  }

  /**
   * TenantOutlet upsert
   */
  export type TenantOutletUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * The filter to search for the TenantOutlet to update in case it exists.
     */
    where: TenantOutletWhereUniqueInput
    /**
     * In case the TenantOutlet found by the `where` argument doesn't exist, create a new TenantOutlet with this data.
     */
    create: XOR<TenantOutletCreateInput, TenantOutletUncheckedCreateInput>
    /**
     * In case the TenantOutlet was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TenantOutletUpdateInput, TenantOutletUncheckedUpdateInput>
  }

  /**
   * TenantOutlet delete
   */
  export type TenantOutletDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
    /**
     * Filter which TenantOutlet to delete.
     */
    where: TenantOutletWhereUniqueInput
  }

  /**
   * TenantOutlet deleteMany
   */
  export type TenantOutletDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantOutlets to delete
     */
    where?: TenantOutletWhereInput
    /**
     * Limit how many TenantOutlets to delete.
     */
    limit?: number
  }

  /**
   * TenantOutlet.subscriptions
   */
  export type TenantOutlet$subscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    where?: TenantSubscriptionWhereInput
    orderBy?: TenantSubscriptionOrderByWithRelationInput | TenantSubscriptionOrderByWithRelationInput[]
    cursor?: TenantSubscriptionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantSubscriptionScalarFieldEnum | TenantSubscriptionScalarFieldEnum[]
  }

  /**
   * TenantOutlet without action
   */
  export type TenantOutletDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantOutlet
     */
    select?: TenantOutletSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantOutlet
     */
    omit?: TenantOutletOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantOutletInclude<ExtArgs> | null
  }


  /**
   * Model Discount
   */

  export type AggregateDiscount = {
    _count: DiscountCountAggregateOutputType | null
    _avg: DiscountAvgAggregateOutputType | null
    _sum: DiscountSumAggregateOutputType | null
    _min: DiscountMinAggregateOutputType | null
    _max: DiscountMaxAggregateOutputType | null
  }

  export type DiscountAvgAggregateOutputType = {
    id: number | null
    value: number | null
    maxUses: number | null
  }

  export type DiscountSumAggregateOutputType = {
    id: number | null
    value: number | null
    maxUses: number | null
  }

  export type DiscountMinAggregateOutputType = {
    id: number | null
    name: string | null
    discountType: string | null
    value: number | null
    startDate: Date | null
    endDate: Date | null
    maxUses: number | null
    appliesTo: string | null
    createdAt: Date | null
  }

  export type DiscountMaxAggregateOutputType = {
    id: number | null
    name: string | null
    discountType: string | null
    value: number | null
    startDate: Date | null
    endDate: Date | null
    maxUses: number | null
    appliesTo: string | null
    createdAt: Date | null
  }

  export type DiscountCountAggregateOutputType = {
    id: number
    name: number
    discountType: number
    value: number
    startDate: number
    endDate: number
    maxUses: number
    appliesTo: number
    createdAt: number
    _all: number
  }


  export type DiscountAvgAggregateInputType = {
    id?: true
    value?: true
    maxUses?: true
  }

  export type DiscountSumAggregateInputType = {
    id?: true
    value?: true
    maxUses?: true
  }

  export type DiscountMinAggregateInputType = {
    id?: true
    name?: true
    discountType?: true
    value?: true
    startDate?: true
    endDate?: true
    maxUses?: true
    appliesTo?: true
    createdAt?: true
  }

  export type DiscountMaxAggregateInputType = {
    id?: true
    name?: true
    discountType?: true
    value?: true
    startDate?: true
    endDate?: true
    maxUses?: true
    appliesTo?: true
    createdAt?: true
  }

  export type DiscountCountAggregateInputType = {
    id?: true
    name?: true
    discountType?: true
    value?: true
    startDate?: true
    endDate?: true
    maxUses?: true
    appliesTo?: true
    createdAt?: true
    _all?: true
  }

  export type DiscountAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Discount to aggregate.
     */
    where?: DiscountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Discounts to fetch.
     */
    orderBy?: DiscountOrderByWithRelationInput | DiscountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DiscountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Discounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Discounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Discounts
    **/
    _count?: true | DiscountCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DiscountAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DiscountSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DiscountMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DiscountMaxAggregateInputType
  }

  export type GetDiscountAggregateType<T extends DiscountAggregateArgs> = {
        [P in keyof T & keyof AggregateDiscount]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDiscount[P]>
      : GetScalarType<T[P], AggregateDiscount[P]>
  }




  export type DiscountGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DiscountWhereInput
    orderBy?: DiscountOrderByWithAggregationInput | DiscountOrderByWithAggregationInput[]
    by: DiscountScalarFieldEnum[] | DiscountScalarFieldEnum
    having?: DiscountScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DiscountCountAggregateInputType | true
    _avg?: DiscountAvgAggregateInputType
    _sum?: DiscountSumAggregateInputType
    _min?: DiscountMinAggregateInputType
    _max?: DiscountMaxAggregateInputType
  }

  export type DiscountGroupByOutputType = {
    id: number
    name: string
    discountType: string
    value: number
    startDate: Date
    endDate: Date | null
    maxUses: number | null
    appliesTo: string
    createdAt: Date
    _count: DiscountCountAggregateOutputType | null
    _avg: DiscountAvgAggregateOutputType | null
    _sum: DiscountSumAggregateOutputType | null
    _min: DiscountMinAggregateOutputType | null
    _max: DiscountMaxAggregateOutputType | null
  }

  type GetDiscountGroupByPayload<T extends DiscountGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DiscountGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DiscountGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DiscountGroupByOutputType[P]>
            : GetScalarType<T[P], DiscountGroupByOutputType[P]>
        }
      >
    >


  export type DiscountSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    discountType?: boolean
    value?: boolean
    startDate?: boolean
    endDate?: boolean
    maxUses?: boolean
    appliesTo?: boolean
    createdAt?: boolean
    subscriptions?: boolean | Discount$subscriptionsArgs<ExtArgs>
    _count?: boolean | DiscountCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["discount"]>



  export type DiscountSelectScalar = {
    id?: boolean
    name?: boolean
    discountType?: boolean
    value?: boolean
    startDate?: boolean
    endDate?: boolean
    maxUses?: boolean
    appliesTo?: boolean
    createdAt?: boolean
  }

  export type DiscountOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "discountType" | "value" | "startDate" | "endDate" | "maxUses" | "appliesTo" | "createdAt", ExtArgs["result"]["discount"]>
  export type DiscountInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscriptions?: boolean | Discount$subscriptionsArgs<ExtArgs>
    _count?: boolean | DiscountCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $DiscountPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Discount"
    objects: {
      subscriptions: Prisma.$TenantSubscriptionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      name: string
      discountType: string
      value: number
      startDate: Date
      endDate: Date | null
      maxUses: number | null
      appliesTo: string
      createdAt: Date
    }, ExtArgs["result"]["discount"]>
    composites: {}
  }

  type DiscountGetPayload<S extends boolean | null | undefined | DiscountDefaultArgs> = $Result.GetResult<Prisma.$DiscountPayload, S>

  type DiscountCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DiscountFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DiscountCountAggregateInputType | true
    }

  export interface DiscountDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Discount'], meta: { name: 'Discount' } }
    /**
     * Find zero or one Discount that matches the filter.
     * @param {DiscountFindUniqueArgs} args - Arguments to find a Discount
     * @example
     * // Get one Discount
     * const discount = await prisma.discount.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DiscountFindUniqueArgs>(args: SelectSubset<T, DiscountFindUniqueArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Discount that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DiscountFindUniqueOrThrowArgs} args - Arguments to find a Discount
     * @example
     * // Get one Discount
     * const discount = await prisma.discount.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DiscountFindUniqueOrThrowArgs>(args: SelectSubset<T, DiscountFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Discount that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscountFindFirstArgs} args - Arguments to find a Discount
     * @example
     * // Get one Discount
     * const discount = await prisma.discount.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DiscountFindFirstArgs>(args?: SelectSubset<T, DiscountFindFirstArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Discount that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscountFindFirstOrThrowArgs} args - Arguments to find a Discount
     * @example
     * // Get one Discount
     * const discount = await prisma.discount.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DiscountFindFirstOrThrowArgs>(args?: SelectSubset<T, DiscountFindFirstOrThrowArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Discounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Discounts
     * const discounts = await prisma.discount.findMany()
     * 
     * // Get first 10 Discounts
     * const discounts = await prisma.discount.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const discountWithIdOnly = await prisma.discount.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DiscountFindManyArgs>(args?: SelectSubset<T, DiscountFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Discount.
     * @param {DiscountCreateArgs} args - Arguments to create a Discount.
     * @example
     * // Create one Discount
     * const Discount = await prisma.discount.create({
     *   data: {
     *     // ... data to create a Discount
     *   }
     * })
     * 
     */
    create<T extends DiscountCreateArgs>(args: SelectSubset<T, DiscountCreateArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Discounts.
     * @param {DiscountCreateManyArgs} args - Arguments to create many Discounts.
     * @example
     * // Create many Discounts
     * const discount = await prisma.discount.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DiscountCreateManyArgs>(args?: SelectSubset<T, DiscountCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Discount.
     * @param {DiscountDeleteArgs} args - Arguments to delete one Discount.
     * @example
     * // Delete one Discount
     * const Discount = await prisma.discount.delete({
     *   where: {
     *     // ... filter to delete one Discount
     *   }
     * })
     * 
     */
    delete<T extends DiscountDeleteArgs>(args: SelectSubset<T, DiscountDeleteArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Discount.
     * @param {DiscountUpdateArgs} args - Arguments to update one Discount.
     * @example
     * // Update one Discount
     * const discount = await prisma.discount.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DiscountUpdateArgs>(args: SelectSubset<T, DiscountUpdateArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Discounts.
     * @param {DiscountDeleteManyArgs} args - Arguments to filter Discounts to delete.
     * @example
     * // Delete a few Discounts
     * const { count } = await prisma.discount.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DiscountDeleteManyArgs>(args?: SelectSubset<T, DiscountDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Discounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Discounts
     * const discount = await prisma.discount.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DiscountUpdateManyArgs>(args: SelectSubset<T, DiscountUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Discount.
     * @param {DiscountUpsertArgs} args - Arguments to update or create a Discount.
     * @example
     * // Update or create a Discount
     * const discount = await prisma.discount.upsert({
     *   create: {
     *     // ... data to create a Discount
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Discount we want to update
     *   }
     * })
     */
    upsert<T extends DiscountUpsertArgs>(args: SelectSubset<T, DiscountUpsertArgs<ExtArgs>>): Prisma__DiscountClient<$Result.GetResult<Prisma.$DiscountPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Discounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscountCountArgs} args - Arguments to filter Discounts to count.
     * @example
     * // Count the number of Discounts
     * const count = await prisma.discount.count({
     *   where: {
     *     // ... the filter for the Discounts we want to count
     *   }
     * })
    **/
    count<T extends DiscountCountArgs>(
      args?: Subset<T, DiscountCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DiscountCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Discount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DiscountAggregateArgs>(args: Subset<T, DiscountAggregateArgs>): Prisma.PrismaPromise<GetDiscountAggregateType<T>>

    /**
     * Group by Discount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscountGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DiscountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DiscountGroupByArgs['orderBy'] }
        : { orderBy?: DiscountGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DiscountGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDiscountGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Discount model
   */
  readonly fields: DiscountFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Discount.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DiscountClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    subscriptions<T extends Discount$subscriptionsArgs<ExtArgs> = {}>(args?: Subset<T, Discount$subscriptionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Discount model
   */
  interface DiscountFieldRefs {
    readonly id: FieldRef<"Discount", 'Int'>
    readonly name: FieldRef<"Discount", 'String'>
    readonly discountType: FieldRef<"Discount", 'String'>
    readonly value: FieldRef<"Discount", 'Float'>
    readonly startDate: FieldRef<"Discount", 'DateTime'>
    readonly endDate: FieldRef<"Discount", 'DateTime'>
    readonly maxUses: FieldRef<"Discount", 'Int'>
    readonly appliesTo: FieldRef<"Discount", 'String'>
    readonly createdAt: FieldRef<"Discount", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Discount findUnique
   */
  export type DiscountFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * Filter, which Discount to fetch.
     */
    where: DiscountWhereUniqueInput
  }

  /**
   * Discount findUniqueOrThrow
   */
  export type DiscountFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * Filter, which Discount to fetch.
     */
    where: DiscountWhereUniqueInput
  }

  /**
   * Discount findFirst
   */
  export type DiscountFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * Filter, which Discount to fetch.
     */
    where?: DiscountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Discounts to fetch.
     */
    orderBy?: DiscountOrderByWithRelationInput | DiscountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Discounts.
     */
    cursor?: DiscountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Discounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Discounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Discounts.
     */
    distinct?: DiscountScalarFieldEnum | DiscountScalarFieldEnum[]
  }

  /**
   * Discount findFirstOrThrow
   */
  export type DiscountFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * Filter, which Discount to fetch.
     */
    where?: DiscountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Discounts to fetch.
     */
    orderBy?: DiscountOrderByWithRelationInput | DiscountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Discounts.
     */
    cursor?: DiscountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Discounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Discounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Discounts.
     */
    distinct?: DiscountScalarFieldEnum | DiscountScalarFieldEnum[]
  }

  /**
   * Discount findMany
   */
  export type DiscountFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * Filter, which Discounts to fetch.
     */
    where?: DiscountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Discounts to fetch.
     */
    orderBy?: DiscountOrderByWithRelationInput | DiscountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Discounts.
     */
    cursor?: DiscountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Discounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Discounts.
     */
    skip?: number
    distinct?: DiscountScalarFieldEnum | DiscountScalarFieldEnum[]
  }

  /**
   * Discount create
   */
  export type DiscountCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * The data needed to create a Discount.
     */
    data: XOR<DiscountCreateInput, DiscountUncheckedCreateInput>
  }

  /**
   * Discount createMany
   */
  export type DiscountCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Discounts.
     */
    data: DiscountCreateManyInput | DiscountCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Discount update
   */
  export type DiscountUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * The data needed to update a Discount.
     */
    data: XOR<DiscountUpdateInput, DiscountUncheckedUpdateInput>
    /**
     * Choose, which Discount to update.
     */
    where: DiscountWhereUniqueInput
  }

  /**
   * Discount updateMany
   */
  export type DiscountUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Discounts.
     */
    data: XOR<DiscountUpdateManyMutationInput, DiscountUncheckedUpdateManyInput>
    /**
     * Filter which Discounts to update
     */
    where?: DiscountWhereInput
    /**
     * Limit how many Discounts to update.
     */
    limit?: number
  }

  /**
   * Discount upsert
   */
  export type DiscountUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * The filter to search for the Discount to update in case it exists.
     */
    where: DiscountWhereUniqueInput
    /**
     * In case the Discount found by the `where` argument doesn't exist, create a new Discount with this data.
     */
    create: XOR<DiscountCreateInput, DiscountUncheckedCreateInput>
    /**
     * In case the Discount was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DiscountUpdateInput, DiscountUncheckedUpdateInput>
  }

  /**
   * Discount delete
   */
  export type DiscountDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
    /**
     * Filter which Discount to delete.
     */
    where: DiscountWhereUniqueInput
  }

  /**
   * Discount deleteMany
   */
  export type DiscountDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Discounts to delete
     */
    where?: DiscountWhereInput
    /**
     * Limit how many Discounts to delete.
     */
    limit?: number
  }

  /**
   * Discount.subscriptions
   */
  export type Discount$subscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    where?: TenantSubscriptionWhereInput
    orderBy?: TenantSubscriptionOrderByWithRelationInput | TenantSubscriptionOrderByWithRelationInput[]
    cursor?: TenantSubscriptionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TenantSubscriptionScalarFieldEnum | TenantSubscriptionScalarFieldEnum[]
  }

  /**
   * Discount without action
   */
  export type DiscountDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Discount
     */
    select?: DiscountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Discount
     */
    omit?: DiscountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiscountInclude<ExtArgs> | null
  }


  /**
   * Model TenantUser
   */

  export type AggregateTenantUser = {
    _count: TenantUserCountAggregateOutputType | null
    _avg: TenantUserAvgAggregateOutputType | null
    _sum: TenantUserSumAggregateOutputType | null
    _min: TenantUserMinAggregateOutputType | null
    _max: TenantUserMaxAggregateOutputType | null
  }

  export type TenantUserAvgAggregateOutputType = {
    id: number | null
    tenantId: number | null
  }

  export type TenantUserSumAggregateOutputType = {
    id: number | null
    tenantId: number | null
  }

  export type TenantUserMinAggregateOutputType = {
    id: number | null
    username: string | null
    password: string | null
    tenantId: number | null
    role: string | null
    isDeleted: boolean | null
  }

  export type TenantUserMaxAggregateOutputType = {
    id: number | null
    username: string | null
    password: string | null
    tenantId: number | null
    role: string | null
    isDeleted: boolean | null
  }

  export type TenantUserCountAggregateOutputType = {
    id: number
    username: number
    password: number
    tenantId: number
    role: number
    isDeleted: number
    _all: number
  }


  export type TenantUserAvgAggregateInputType = {
    id?: true
    tenantId?: true
  }

  export type TenantUserSumAggregateInputType = {
    id?: true
    tenantId?: true
  }

  export type TenantUserMinAggregateInputType = {
    id?: true
    username?: true
    password?: true
    tenantId?: true
    role?: true
    isDeleted?: true
  }

  export type TenantUserMaxAggregateInputType = {
    id?: true
    username?: true
    password?: true
    tenantId?: true
    role?: true
    isDeleted?: true
  }

  export type TenantUserCountAggregateInputType = {
    id?: true
    username?: true
    password?: true
    tenantId?: true
    role?: true
    isDeleted?: true
    _all?: true
  }

  export type TenantUserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantUser to aggregate.
     */
    where?: TenantUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantUsers to fetch.
     */
    orderBy?: TenantUserOrderByWithRelationInput | TenantUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TenantUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TenantUsers
    **/
    _count?: true | TenantUserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TenantUserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TenantUserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TenantUserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TenantUserMaxAggregateInputType
  }

  export type GetTenantUserAggregateType<T extends TenantUserAggregateArgs> = {
        [P in keyof T & keyof AggregateTenantUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTenantUser[P]>
      : GetScalarType<T[P], AggregateTenantUser[P]>
  }




  export type TenantUserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantUserWhereInput
    orderBy?: TenantUserOrderByWithAggregationInput | TenantUserOrderByWithAggregationInput[]
    by: TenantUserScalarFieldEnum[] | TenantUserScalarFieldEnum
    having?: TenantUserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TenantUserCountAggregateInputType | true
    _avg?: TenantUserAvgAggregateInputType
    _sum?: TenantUserSumAggregateInputType
    _min?: TenantUserMinAggregateInputType
    _max?: TenantUserMaxAggregateInputType
  }

  export type TenantUserGroupByOutputType = {
    id: number
    username: string
    password: string | null
    tenantId: number
    role: string
    isDeleted: boolean
    _count: TenantUserCountAggregateOutputType | null
    _avg: TenantUserAvgAggregateOutputType | null
    _sum: TenantUserSumAggregateOutputType | null
    _min: TenantUserMinAggregateOutputType | null
    _max: TenantUserMaxAggregateOutputType | null
  }

  type GetTenantUserGroupByPayload<T extends TenantUserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TenantUserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TenantUserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TenantUserGroupByOutputType[P]>
            : GetScalarType<T[P], TenantUserGroupByOutputType[P]>
        }
      >
    >


  export type TenantUserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    username?: boolean
    password?: boolean
    tenantId?: boolean
    role?: boolean
    isDeleted?: boolean
    tenant?: boolean | TenantUser$tenantArgs<ExtArgs>
    pushyDevices?: boolean | TenantUser$pushyDevicesArgs<ExtArgs>
    _count?: boolean | TenantUserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tenantUser"]>



  export type TenantUserSelectScalar = {
    id?: boolean
    username?: boolean
    password?: boolean
    tenantId?: boolean
    role?: boolean
    isDeleted?: boolean
  }

  export type TenantUserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "username" | "password" | "tenantId" | "role" | "isDeleted", ExtArgs["result"]["tenantUser"]>
  export type TenantUserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    tenant?: boolean | TenantUser$tenantArgs<ExtArgs>
    pushyDevices?: boolean | TenantUser$pushyDevicesArgs<ExtArgs>
    _count?: boolean | TenantUserCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $TenantUserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TenantUser"
    objects: {
      tenant: Prisma.$TenantPayload<ExtArgs> | null
      pushyDevices: Prisma.$PushyDevicePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      username: string
      password: string | null
      tenantId: number
      role: string
      isDeleted: boolean
    }, ExtArgs["result"]["tenantUser"]>
    composites: {}
  }

  type TenantUserGetPayload<S extends boolean | null | undefined | TenantUserDefaultArgs> = $Result.GetResult<Prisma.$TenantUserPayload, S>

  type TenantUserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TenantUserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TenantUserCountAggregateInputType | true
    }

  export interface TenantUserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TenantUser'], meta: { name: 'TenantUser' } }
    /**
     * Find zero or one TenantUser that matches the filter.
     * @param {TenantUserFindUniqueArgs} args - Arguments to find a TenantUser
     * @example
     * // Get one TenantUser
     * const tenantUser = await prisma.tenantUser.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TenantUserFindUniqueArgs>(args: SelectSubset<T, TenantUserFindUniqueArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TenantUser that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TenantUserFindUniqueOrThrowArgs} args - Arguments to find a TenantUser
     * @example
     * // Get one TenantUser
     * const tenantUser = await prisma.tenantUser.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TenantUserFindUniqueOrThrowArgs>(args: SelectSubset<T, TenantUserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantUser that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUserFindFirstArgs} args - Arguments to find a TenantUser
     * @example
     * // Get one TenantUser
     * const tenantUser = await prisma.tenantUser.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TenantUserFindFirstArgs>(args?: SelectSubset<T, TenantUserFindFirstArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantUser that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUserFindFirstOrThrowArgs} args - Arguments to find a TenantUser
     * @example
     * // Get one TenantUser
     * const tenantUser = await prisma.tenantUser.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TenantUserFindFirstOrThrowArgs>(args?: SelectSubset<T, TenantUserFindFirstOrThrowArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TenantUsers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TenantUsers
     * const tenantUsers = await prisma.tenantUser.findMany()
     * 
     * // Get first 10 TenantUsers
     * const tenantUsers = await prisma.tenantUser.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tenantUserWithIdOnly = await prisma.tenantUser.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TenantUserFindManyArgs>(args?: SelectSubset<T, TenantUserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TenantUser.
     * @param {TenantUserCreateArgs} args - Arguments to create a TenantUser.
     * @example
     * // Create one TenantUser
     * const TenantUser = await prisma.tenantUser.create({
     *   data: {
     *     // ... data to create a TenantUser
     *   }
     * })
     * 
     */
    create<T extends TenantUserCreateArgs>(args: SelectSubset<T, TenantUserCreateArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TenantUsers.
     * @param {TenantUserCreateManyArgs} args - Arguments to create many TenantUsers.
     * @example
     * // Create many TenantUsers
     * const tenantUser = await prisma.tenantUser.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TenantUserCreateManyArgs>(args?: SelectSubset<T, TenantUserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a TenantUser.
     * @param {TenantUserDeleteArgs} args - Arguments to delete one TenantUser.
     * @example
     * // Delete one TenantUser
     * const TenantUser = await prisma.tenantUser.delete({
     *   where: {
     *     // ... filter to delete one TenantUser
     *   }
     * })
     * 
     */
    delete<T extends TenantUserDeleteArgs>(args: SelectSubset<T, TenantUserDeleteArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TenantUser.
     * @param {TenantUserUpdateArgs} args - Arguments to update one TenantUser.
     * @example
     * // Update one TenantUser
     * const tenantUser = await prisma.tenantUser.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TenantUserUpdateArgs>(args: SelectSubset<T, TenantUserUpdateArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TenantUsers.
     * @param {TenantUserDeleteManyArgs} args - Arguments to filter TenantUsers to delete.
     * @example
     * // Delete a few TenantUsers
     * const { count } = await prisma.tenantUser.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TenantUserDeleteManyArgs>(args?: SelectSubset<T, TenantUserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TenantUsers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TenantUsers
     * const tenantUser = await prisma.tenantUser.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TenantUserUpdateManyArgs>(args: SelectSubset<T, TenantUserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one TenantUser.
     * @param {TenantUserUpsertArgs} args - Arguments to update or create a TenantUser.
     * @example
     * // Update or create a TenantUser
     * const tenantUser = await prisma.tenantUser.upsert({
     *   create: {
     *     // ... data to create a TenantUser
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TenantUser we want to update
     *   }
     * })
     */
    upsert<T extends TenantUserUpsertArgs>(args: SelectSubset<T, TenantUserUpsertArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TenantUsers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUserCountArgs} args - Arguments to filter TenantUsers to count.
     * @example
     * // Count the number of TenantUsers
     * const count = await prisma.tenantUser.count({
     *   where: {
     *     // ... the filter for the TenantUsers we want to count
     *   }
     * })
    **/
    count<T extends TenantUserCountArgs>(
      args?: Subset<T, TenantUserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TenantUserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TenantUser.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TenantUserAggregateArgs>(args: Subset<T, TenantUserAggregateArgs>): Prisma.PrismaPromise<GetTenantUserAggregateType<T>>

    /**
     * Group by TenantUser.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TenantUserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TenantUserGroupByArgs['orderBy'] }
        : { orderBy?: TenantUserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TenantUserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTenantUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TenantUser model
   */
  readonly fields: TenantUserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TenantUser.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TenantUserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    tenant<T extends TenantUser$tenantArgs<ExtArgs> = {}>(args?: Subset<T, TenantUser$tenantArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    pushyDevices<T extends TenantUser$pushyDevicesArgs<ExtArgs> = {}>(args?: Subset<T, TenantUser$pushyDevicesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TenantUser model
   */
  interface TenantUserFieldRefs {
    readonly id: FieldRef<"TenantUser", 'Int'>
    readonly username: FieldRef<"TenantUser", 'String'>
    readonly password: FieldRef<"TenantUser", 'String'>
    readonly tenantId: FieldRef<"TenantUser", 'Int'>
    readonly role: FieldRef<"TenantUser", 'String'>
    readonly isDeleted: FieldRef<"TenantUser", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * TenantUser findUnique
   */
  export type TenantUserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * Filter, which TenantUser to fetch.
     */
    where: TenantUserWhereUniqueInput
  }

  /**
   * TenantUser findUniqueOrThrow
   */
  export type TenantUserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * Filter, which TenantUser to fetch.
     */
    where: TenantUserWhereUniqueInput
  }

  /**
   * TenantUser findFirst
   */
  export type TenantUserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * Filter, which TenantUser to fetch.
     */
    where?: TenantUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantUsers to fetch.
     */
    orderBy?: TenantUserOrderByWithRelationInput | TenantUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantUsers.
     */
    cursor?: TenantUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantUsers.
     */
    distinct?: TenantUserScalarFieldEnum | TenantUserScalarFieldEnum[]
  }

  /**
   * TenantUser findFirstOrThrow
   */
  export type TenantUserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * Filter, which TenantUser to fetch.
     */
    where?: TenantUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantUsers to fetch.
     */
    orderBy?: TenantUserOrderByWithRelationInput | TenantUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantUsers.
     */
    cursor?: TenantUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantUsers.
     */
    distinct?: TenantUserScalarFieldEnum | TenantUserScalarFieldEnum[]
  }

  /**
   * TenantUser findMany
   */
  export type TenantUserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * Filter, which TenantUsers to fetch.
     */
    where?: TenantUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantUsers to fetch.
     */
    orderBy?: TenantUserOrderByWithRelationInput | TenantUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TenantUsers.
     */
    cursor?: TenantUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantUsers.
     */
    skip?: number
    distinct?: TenantUserScalarFieldEnum | TenantUserScalarFieldEnum[]
  }

  /**
   * TenantUser create
   */
  export type TenantUserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * The data needed to create a TenantUser.
     */
    data: XOR<TenantUserCreateInput, TenantUserUncheckedCreateInput>
  }

  /**
   * TenantUser createMany
   */
  export type TenantUserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TenantUsers.
     */
    data: TenantUserCreateManyInput | TenantUserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TenantUser update
   */
  export type TenantUserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * The data needed to update a TenantUser.
     */
    data: XOR<TenantUserUpdateInput, TenantUserUncheckedUpdateInput>
    /**
     * Choose, which TenantUser to update.
     */
    where: TenantUserWhereUniqueInput
  }

  /**
   * TenantUser updateMany
   */
  export type TenantUserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TenantUsers.
     */
    data: XOR<TenantUserUpdateManyMutationInput, TenantUserUncheckedUpdateManyInput>
    /**
     * Filter which TenantUsers to update
     */
    where?: TenantUserWhereInput
    /**
     * Limit how many TenantUsers to update.
     */
    limit?: number
  }

  /**
   * TenantUser upsert
   */
  export type TenantUserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * The filter to search for the TenantUser to update in case it exists.
     */
    where: TenantUserWhereUniqueInput
    /**
     * In case the TenantUser found by the `where` argument doesn't exist, create a new TenantUser with this data.
     */
    create: XOR<TenantUserCreateInput, TenantUserUncheckedCreateInput>
    /**
     * In case the TenantUser was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TenantUserUpdateInput, TenantUserUncheckedUpdateInput>
  }

  /**
   * TenantUser delete
   */
  export type TenantUserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
    /**
     * Filter which TenantUser to delete.
     */
    where: TenantUserWhereUniqueInput
  }

  /**
   * TenantUser deleteMany
   */
  export type TenantUserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantUsers to delete
     */
    where?: TenantUserWhereInput
    /**
     * Limit how many TenantUsers to delete.
     */
    limit?: number
  }

  /**
   * TenantUser.tenant
   */
  export type TenantUser$tenantArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Tenant
     */
    omit?: TenantOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null
    where?: TenantWhereInput
  }

  /**
   * TenantUser.pushyDevices
   */
  export type TenantUser$pushyDevicesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    where?: PushyDeviceWhereInput
    orderBy?: PushyDeviceOrderByWithRelationInput | PushyDeviceOrderByWithRelationInput[]
    cursor?: PushyDeviceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PushyDeviceScalarFieldEnum | PushyDeviceScalarFieldEnum[]
  }

  /**
   * TenantUser without action
   */
  export type TenantUserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantUser
     */
    select?: TenantUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantUser
     */
    omit?: TenantUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantUserInclude<ExtArgs> | null
  }


  /**
   * Model RefreshToken
   */

  export type AggregateRefreshToken = {
    _count: RefreshTokenCountAggregateOutputType | null
    _avg: RefreshTokenAvgAggregateOutputType | null
    _sum: RefreshTokenSumAggregateOutputType | null
    _min: RefreshTokenMinAggregateOutputType | null
    _max: RefreshTokenMaxAggregateOutputType | null
  }

  export type RefreshTokenAvgAggregateOutputType = {
    id: number | null
    tenantUserId: number | null
  }

  export type RefreshTokenSumAggregateOutputType = {
    id: number | null
    tenantUserId: number | null
  }

  export type RefreshTokenMinAggregateOutputType = {
    id: number | null
    tenantUserId: number | null
    token: string | null
    expired: Date | null
    created: Date | null
    createdByIP: string | null
    revoked: Date | null
    deleted: boolean | null
  }

  export type RefreshTokenMaxAggregateOutputType = {
    id: number | null
    tenantUserId: number | null
    token: string | null
    expired: Date | null
    created: Date | null
    createdByIP: string | null
    revoked: Date | null
    deleted: boolean | null
  }

  export type RefreshTokenCountAggregateOutputType = {
    id: number
    tenantUserId: number
    token: number
    expired: number
    created: number
    createdByIP: number
    revoked: number
    deleted: number
    _all: number
  }


  export type RefreshTokenAvgAggregateInputType = {
    id?: true
    tenantUserId?: true
  }

  export type RefreshTokenSumAggregateInputType = {
    id?: true
    tenantUserId?: true
  }

  export type RefreshTokenMinAggregateInputType = {
    id?: true
    tenantUserId?: true
    token?: true
    expired?: true
    created?: true
    createdByIP?: true
    revoked?: true
    deleted?: true
  }

  export type RefreshTokenMaxAggregateInputType = {
    id?: true
    tenantUserId?: true
    token?: true
    expired?: true
    created?: true
    createdByIP?: true
    revoked?: true
    deleted?: true
  }

  export type RefreshTokenCountAggregateInputType = {
    id?: true
    tenantUserId?: true
    token?: true
    expired?: true
    created?: true
    createdByIP?: true
    revoked?: true
    deleted?: true
    _all?: true
  }

  export type RefreshTokenAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RefreshToken to aggregate.
     */
    where?: RefreshTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RefreshTokens to fetch.
     */
    orderBy?: RefreshTokenOrderByWithRelationInput | RefreshTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RefreshTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RefreshTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RefreshTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RefreshTokens
    **/
    _count?: true | RefreshTokenCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: RefreshTokenAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: RefreshTokenSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RefreshTokenMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RefreshTokenMaxAggregateInputType
  }

  export type GetRefreshTokenAggregateType<T extends RefreshTokenAggregateArgs> = {
        [P in keyof T & keyof AggregateRefreshToken]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRefreshToken[P]>
      : GetScalarType<T[P], AggregateRefreshToken[P]>
  }




  export type RefreshTokenGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RefreshTokenWhereInput
    orderBy?: RefreshTokenOrderByWithAggregationInput | RefreshTokenOrderByWithAggregationInput[]
    by: RefreshTokenScalarFieldEnum[] | RefreshTokenScalarFieldEnum
    having?: RefreshTokenScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RefreshTokenCountAggregateInputType | true
    _avg?: RefreshTokenAvgAggregateInputType
    _sum?: RefreshTokenSumAggregateInputType
    _min?: RefreshTokenMinAggregateInputType
    _max?: RefreshTokenMaxAggregateInputType
  }

  export type RefreshTokenGroupByOutputType = {
    id: number
    tenantUserId: number
    token: string
    expired: Date | null
    created: Date
    createdByIP: string | null
    revoked: Date | null
    deleted: boolean
    _count: RefreshTokenCountAggregateOutputType | null
    _avg: RefreshTokenAvgAggregateOutputType | null
    _sum: RefreshTokenSumAggregateOutputType | null
    _min: RefreshTokenMinAggregateOutputType | null
    _max: RefreshTokenMaxAggregateOutputType | null
  }

  type GetRefreshTokenGroupByPayload<T extends RefreshTokenGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RefreshTokenGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RefreshTokenGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RefreshTokenGroupByOutputType[P]>
            : GetScalarType<T[P], RefreshTokenGroupByOutputType[P]>
        }
      >
    >


  export type RefreshTokenSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantUserId?: boolean
    token?: boolean
    expired?: boolean
    created?: boolean
    createdByIP?: boolean
    revoked?: boolean
    deleted?: boolean
  }, ExtArgs["result"]["refreshToken"]>



  export type RefreshTokenSelectScalar = {
    id?: boolean
    tenantUserId?: boolean
    token?: boolean
    expired?: boolean
    created?: boolean
    createdByIP?: boolean
    revoked?: boolean
    deleted?: boolean
  }

  export type RefreshTokenOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "tenantUserId" | "token" | "expired" | "created" | "createdByIP" | "revoked" | "deleted", ExtArgs["result"]["refreshToken"]>

  export type $RefreshTokenPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RefreshToken"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      tenantUserId: number
      token: string
      expired: Date | null
      created: Date
      createdByIP: string | null
      revoked: Date | null
      deleted: boolean
    }, ExtArgs["result"]["refreshToken"]>
    composites: {}
  }

  type RefreshTokenGetPayload<S extends boolean | null | undefined | RefreshTokenDefaultArgs> = $Result.GetResult<Prisma.$RefreshTokenPayload, S>

  type RefreshTokenCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RefreshTokenFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RefreshTokenCountAggregateInputType | true
    }

  export interface RefreshTokenDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RefreshToken'], meta: { name: 'RefreshToken' } }
    /**
     * Find zero or one RefreshToken that matches the filter.
     * @param {RefreshTokenFindUniqueArgs} args - Arguments to find a RefreshToken
     * @example
     * // Get one RefreshToken
     * const refreshToken = await prisma.refreshToken.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RefreshTokenFindUniqueArgs>(args: SelectSubset<T, RefreshTokenFindUniqueArgs<ExtArgs>>): Prisma__RefreshTokenClient<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one RefreshToken that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RefreshTokenFindUniqueOrThrowArgs} args - Arguments to find a RefreshToken
     * @example
     * // Get one RefreshToken
     * const refreshToken = await prisma.refreshToken.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RefreshTokenFindUniqueOrThrowArgs>(args: SelectSubset<T, RefreshTokenFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RefreshTokenClient<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RefreshToken that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenFindFirstArgs} args - Arguments to find a RefreshToken
     * @example
     * // Get one RefreshToken
     * const refreshToken = await prisma.refreshToken.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RefreshTokenFindFirstArgs>(args?: SelectSubset<T, RefreshTokenFindFirstArgs<ExtArgs>>): Prisma__RefreshTokenClient<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RefreshToken that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenFindFirstOrThrowArgs} args - Arguments to find a RefreshToken
     * @example
     * // Get one RefreshToken
     * const refreshToken = await prisma.refreshToken.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RefreshTokenFindFirstOrThrowArgs>(args?: SelectSubset<T, RefreshTokenFindFirstOrThrowArgs<ExtArgs>>): Prisma__RefreshTokenClient<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more RefreshTokens that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RefreshTokens
     * const refreshTokens = await prisma.refreshToken.findMany()
     * 
     * // Get first 10 RefreshTokens
     * const refreshTokens = await prisma.refreshToken.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const refreshTokenWithIdOnly = await prisma.refreshToken.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RefreshTokenFindManyArgs>(args?: SelectSubset<T, RefreshTokenFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a RefreshToken.
     * @param {RefreshTokenCreateArgs} args - Arguments to create a RefreshToken.
     * @example
     * // Create one RefreshToken
     * const RefreshToken = await prisma.refreshToken.create({
     *   data: {
     *     // ... data to create a RefreshToken
     *   }
     * })
     * 
     */
    create<T extends RefreshTokenCreateArgs>(args: SelectSubset<T, RefreshTokenCreateArgs<ExtArgs>>): Prisma__RefreshTokenClient<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many RefreshTokens.
     * @param {RefreshTokenCreateManyArgs} args - Arguments to create many RefreshTokens.
     * @example
     * // Create many RefreshTokens
     * const refreshToken = await prisma.refreshToken.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RefreshTokenCreateManyArgs>(args?: SelectSubset<T, RefreshTokenCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a RefreshToken.
     * @param {RefreshTokenDeleteArgs} args - Arguments to delete one RefreshToken.
     * @example
     * // Delete one RefreshToken
     * const RefreshToken = await prisma.refreshToken.delete({
     *   where: {
     *     // ... filter to delete one RefreshToken
     *   }
     * })
     * 
     */
    delete<T extends RefreshTokenDeleteArgs>(args: SelectSubset<T, RefreshTokenDeleteArgs<ExtArgs>>): Prisma__RefreshTokenClient<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one RefreshToken.
     * @param {RefreshTokenUpdateArgs} args - Arguments to update one RefreshToken.
     * @example
     * // Update one RefreshToken
     * const refreshToken = await prisma.refreshToken.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RefreshTokenUpdateArgs>(args: SelectSubset<T, RefreshTokenUpdateArgs<ExtArgs>>): Prisma__RefreshTokenClient<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more RefreshTokens.
     * @param {RefreshTokenDeleteManyArgs} args - Arguments to filter RefreshTokens to delete.
     * @example
     * // Delete a few RefreshTokens
     * const { count } = await prisma.refreshToken.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RefreshTokenDeleteManyArgs>(args?: SelectSubset<T, RefreshTokenDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RefreshTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RefreshTokens
     * const refreshToken = await prisma.refreshToken.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RefreshTokenUpdateManyArgs>(args: SelectSubset<T, RefreshTokenUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one RefreshToken.
     * @param {RefreshTokenUpsertArgs} args - Arguments to update or create a RefreshToken.
     * @example
     * // Update or create a RefreshToken
     * const refreshToken = await prisma.refreshToken.upsert({
     *   create: {
     *     // ... data to create a RefreshToken
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RefreshToken we want to update
     *   }
     * })
     */
    upsert<T extends RefreshTokenUpsertArgs>(args: SelectSubset<T, RefreshTokenUpsertArgs<ExtArgs>>): Prisma__RefreshTokenClient<$Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of RefreshTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenCountArgs} args - Arguments to filter RefreshTokens to count.
     * @example
     * // Count the number of RefreshTokens
     * const count = await prisma.refreshToken.count({
     *   where: {
     *     // ... the filter for the RefreshTokens we want to count
     *   }
     * })
    **/
    count<T extends RefreshTokenCountArgs>(
      args?: Subset<T, RefreshTokenCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RefreshTokenCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RefreshToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RefreshTokenAggregateArgs>(args: Subset<T, RefreshTokenAggregateArgs>): Prisma.PrismaPromise<GetRefreshTokenAggregateType<T>>

    /**
     * Group by RefreshToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RefreshTokenGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RefreshTokenGroupByArgs['orderBy'] }
        : { orderBy?: RefreshTokenGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RefreshTokenGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRefreshTokenGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RefreshToken model
   */
  readonly fields: RefreshTokenFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RefreshToken.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RefreshTokenClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RefreshToken model
   */
  interface RefreshTokenFieldRefs {
    readonly id: FieldRef<"RefreshToken", 'Int'>
    readonly tenantUserId: FieldRef<"RefreshToken", 'Int'>
    readonly token: FieldRef<"RefreshToken", 'String'>
    readonly expired: FieldRef<"RefreshToken", 'DateTime'>
    readonly created: FieldRef<"RefreshToken", 'DateTime'>
    readonly createdByIP: FieldRef<"RefreshToken", 'String'>
    readonly revoked: FieldRef<"RefreshToken", 'DateTime'>
    readonly deleted: FieldRef<"RefreshToken", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * RefreshToken findUnique
   */
  export type RefreshTokenFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * Filter, which RefreshToken to fetch.
     */
    where: RefreshTokenWhereUniqueInput
  }

  /**
   * RefreshToken findUniqueOrThrow
   */
  export type RefreshTokenFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * Filter, which RefreshToken to fetch.
     */
    where: RefreshTokenWhereUniqueInput
  }

  /**
   * RefreshToken findFirst
   */
  export type RefreshTokenFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * Filter, which RefreshToken to fetch.
     */
    where?: RefreshTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RefreshTokens to fetch.
     */
    orderBy?: RefreshTokenOrderByWithRelationInput | RefreshTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RefreshTokens.
     */
    cursor?: RefreshTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RefreshTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RefreshTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RefreshTokens.
     */
    distinct?: RefreshTokenScalarFieldEnum | RefreshTokenScalarFieldEnum[]
  }

  /**
   * RefreshToken findFirstOrThrow
   */
  export type RefreshTokenFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * Filter, which RefreshToken to fetch.
     */
    where?: RefreshTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RefreshTokens to fetch.
     */
    orderBy?: RefreshTokenOrderByWithRelationInput | RefreshTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RefreshTokens.
     */
    cursor?: RefreshTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RefreshTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RefreshTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RefreshTokens.
     */
    distinct?: RefreshTokenScalarFieldEnum | RefreshTokenScalarFieldEnum[]
  }

  /**
   * RefreshToken findMany
   */
  export type RefreshTokenFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * Filter, which RefreshTokens to fetch.
     */
    where?: RefreshTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RefreshTokens to fetch.
     */
    orderBy?: RefreshTokenOrderByWithRelationInput | RefreshTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RefreshTokens.
     */
    cursor?: RefreshTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RefreshTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RefreshTokens.
     */
    skip?: number
    distinct?: RefreshTokenScalarFieldEnum | RefreshTokenScalarFieldEnum[]
  }

  /**
   * RefreshToken create
   */
  export type RefreshTokenCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * The data needed to create a RefreshToken.
     */
    data: XOR<RefreshTokenCreateInput, RefreshTokenUncheckedCreateInput>
  }

  /**
   * RefreshToken createMany
   */
  export type RefreshTokenCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RefreshTokens.
     */
    data: RefreshTokenCreateManyInput | RefreshTokenCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RefreshToken update
   */
  export type RefreshTokenUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * The data needed to update a RefreshToken.
     */
    data: XOR<RefreshTokenUpdateInput, RefreshTokenUncheckedUpdateInput>
    /**
     * Choose, which RefreshToken to update.
     */
    where: RefreshTokenWhereUniqueInput
  }

  /**
   * RefreshToken updateMany
   */
  export type RefreshTokenUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RefreshTokens.
     */
    data: XOR<RefreshTokenUpdateManyMutationInput, RefreshTokenUncheckedUpdateManyInput>
    /**
     * Filter which RefreshTokens to update
     */
    where?: RefreshTokenWhereInput
    /**
     * Limit how many RefreshTokens to update.
     */
    limit?: number
  }

  /**
   * RefreshToken upsert
   */
  export type RefreshTokenUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * The filter to search for the RefreshToken to update in case it exists.
     */
    where: RefreshTokenWhereUniqueInput
    /**
     * In case the RefreshToken found by the `where` argument doesn't exist, create a new RefreshToken with this data.
     */
    create: XOR<RefreshTokenCreateInput, RefreshTokenUncheckedCreateInput>
    /**
     * In case the RefreshToken was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RefreshTokenUpdateInput, RefreshTokenUncheckedUpdateInput>
  }

  /**
   * RefreshToken delete
   */
  export type RefreshTokenDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
    /**
     * Filter which RefreshToken to delete.
     */
    where: RefreshTokenWhereUniqueInput
  }

  /**
   * RefreshToken deleteMany
   */
  export type RefreshTokenDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RefreshTokens to delete
     */
    where?: RefreshTokenWhereInput
    /**
     * Limit how many RefreshTokens to delete.
     */
    limit?: number
  }

  /**
   * RefreshToken without action
   */
  export type RefreshTokenDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RefreshToken
     */
    omit?: RefreshTokenOmit<ExtArgs> | null
  }


  /**
   * Model Permission
   */

  export type AggregatePermission = {
    _count: PermissionCountAggregateOutputType | null
    _avg: PermissionAvgAggregateOutputType | null
    _sum: PermissionSumAggregateOutputType | null
    _min: PermissionMinAggregateOutputType | null
    _max: PermissionMaxAggregateOutputType | null
  }

  export type PermissionAvgAggregateOutputType = {
    id: number | null
    version: number | null
  }

  export type PermissionSumAggregateOutputType = {
    id: number | null
    version: number | null
  }

  export type PermissionMinAggregateOutputType = {
    id: number | null
    name: string | null
    category: string | null
    description: string | null
    allowedRoles: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deleted: boolean | null
    deletedAt: Date | null
    version: number | null
  }

  export type PermissionMaxAggregateOutputType = {
    id: number | null
    name: string | null
    category: string | null
    description: string | null
    allowedRoles: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deleted: boolean | null
    deletedAt: Date | null
    version: number | null
  }

  export type PermissionCountAggregateOutputType = {
    id: number
    name: number
    category: number
    description: number
    allowedRoles: number
    createdAt: number
    updatedAt: number
    deleted: number
    deletedAt: number
    version: number
    _all: number
  }


  export type PermissionAvgAggregateInputType = {
    id?: true
    version?: true
  }

  export type PermissionSumAggregateInputType = {
    id?: true
    version?: true
  }

  export type PermissionMinAggregateInputType = {
    id?: true
    name?: true
    category?: true
    description?: true
    allowedRoles?: true
    createdAt?: true
    updatedAt?: true
    deleted?: true
    deletedAt?: true
    version?: true
  }

  export type PermissionMaxAggregateInputType = {
    id?: true
    name?: true
    category?: true
    description?: true
    allowedRoles?: true
    createdAt?: true
    updatedAt?: true
    deleted?: true
    deletedAt?: true
    version?: true
  }

  export type PermissionCountAggregateInputType = {
    id?: true
    name?: true
    category?: true
    description?: true
    allowedRoles?: true
    createdAt?: true
    updatedAt?: true
    deleted?: true
    deletedAt?: true
    version?: true
    _all?: true
  }

  export type PermissionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Permission to aggregate.
     */
    where?: PermissionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Permissions to fetch.
     */
    orderBy?: PermissionOrderByWithRelationInput | PermissionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PermissionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Permissions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Permissions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Permissions
    **/
    _count?: true | PermissionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PermissionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PermissionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PermissionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PermissionMaxAggregateInputType
  }

  export type GetPermissionAggregateType<T extends PermissionAggregateArgs> = {
        [P in keyof T & keyof AggregatePermission]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePermission[P]>
      : GetScalarType<T[P], AggregatePermission[P]>
  }




  export type PermissionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PermissionWhereInput
    orderBy?: PermissionOrderByWithAggregationInput | PermissionOrderByWithAggregationInput[]
    by: PermissionScalarFieldEnum[] | PermissionScalarFieldEnum
    having?: PermissionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PermissionCountAggregateInputType | true
    _avg?: PermissionAvgAggregateInputType
    _sum?: PermissionSumAggregateInputType
    _min?: PermissionMinAggregateInputType
    _max?: PermissionMaxAggregateInputType
  }

  export type PermissionGroupByOutputType = {
    id: number
    name: string
    category: string
    description: string | null
    allowedRoles: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deleted: boolean
    deletedAt: Date | null
    version: number | null
    _count: PermissionCountAggregateOutputType | null
    _avg: PermissionAvgAggregateOutputType | null
    _sum: PermissionSumAggregateOutputType | null
    _min: PermissionMinAggregateOutputType | null
    _max: PermissionMaxAggregateOutputType | null
  }

  type GetPermissionGroupByPayload<T extends PermissionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PermissionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PermissionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PermissionGroupByOutputType[P]>
            : GetScalarType<T[P], PermissionGroupByOutputType[P]>
        }
      >
    >


  export type PermissionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    category?: boolean
    description?: boolean
    allowedRoles?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deleted?: boolean
    deletedAt?: boolean
    version?: boolean
  }, ExtArgs["result"]["permission"]>



  export type PermissionSelectScalar = {
    id?: boolean
    name?: boolean
    category?: boolean
    description?: boolean
    allowedRoles?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deleted?: boolean
    deletedAt?: boolean
    version?: boolean
  }

  export type PermissionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "category" | "description" | "allowedRoles" | "createdAt" | "updatedAt" | "deleted" | "deletedAt" | "version", ExtArgs["result"]["permission"]>

  export type $PermissionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Permission"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      name: string
      category: string
      description: string | null
      allowedRoles: string | null
      createdAt: Date | null
      updatedAt: Date | null
      deleted: boolean
      deletedAt: Date | null
      version: number | null
    }, ExtArgs["result"]["permission"]>
    composites: {}
  }

  type PermissionGetPayload<S extends boolean | null | undefined | PermissionDefaultArgs> = $Result.GetResult<Prisma.$PermissionPayload, S>

  type PermissionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PermissionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PermissionCountAggregateInputType | true
    }

  export interface PermissionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Permission'], meta: { name: 'Permission' } }
    /**
     * Find zero or one Permission that matches the filter.
     * @param {PermissionFindUniqueArgs} args - Arguments to find a Permission
     * @example
     * // Get one Permission
     * const permission = await prisma.permission.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PermissionFindUniqueArgs>(args: SelectSubset<T, PermissionFindUniqueArgs<ExtArgs>>): Prisma__PermissionClient<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Permission that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PermissionFindUniqueOrThrowArgs} args - Arguments to find a Permission
     * @example
     * // Get one Permission
     * const permission = await prisma.permission.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PermissionFindUniqueOrThrowArgs>(args: SelectSubset<T, PermissionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PermissionClient<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Permission that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PermissionFindFirstArgs} args - Arguments to find a Permission
     * @example
     * // Get one Permission
     * const permission = await prisma.permission.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PermissionFindFirstArgs>(args?: SelectSubset<T, PermissionFindFirstArgs<ExtArgs>>): Prisma__PermissionClient<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Permission that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PermissionFindFirstOrThrowArgs} args - Arguments to find a Permission
     * @example
     * // Get one Permission
     * const permission = await prisma.permission.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PermissionFindFirstOrThrowArgs>(args?: SelectSubset<T, PermissionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PermissionClient<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Permissions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PermissionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Permissions
     * const permissions = await prisma.permission.findMany()
     * 
     * // Get first 10 Permissions
     * const permissions = await prisma.permission.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const permissionWithIdOnly = await prisma.permission.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PermissionFindManyArgs>(args?: SelectSubset<T, PermissionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Permission.
     * @param {PermissionCreateArgs} args - Arguments to create a Permission.
     * @example
     * // Create one Permission
     * const Permission = await prisma.permission.create({
     *   data: {
     *     // ... data to create a Permission
     *   }
     * })
     * 
     */
    create<T extends PermissionCreateArgs>(args: SelectSubset<T, PermissionCreateArgs<ExtArgs>>): Prisma__PermissionClient<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Permissions.
     * @param {PermissionCreateManyArgs} args - Arguments to create many Permissions.
     * @example
     * // Create many Permissions
     * const permission = await prisma.permission.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PermissionCreateManyArgs>(args?: SelectSubset<T, PermissionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Permission.
     * @param {PermissionDeleteArgs} args - Arguments to delete one Permission.
     * @example
     * // Delete one Permission
     * const Permission = await prisma.permission.delete({
     *   where: {
     *     // ... filter to delete one Permission
     *   }
     * })
     * 
     */
    delete<T extends PermissionDeleteArgs>(args: SelectSubset<T, PermissionDeleteArgs<ExtArgs>>): Prisma__PermissionClient<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Permission.
     * @param {PermissionUpdateArgs} args - Arguments to update one Permission.
     * @example
     * // Update one Permission
     * const permission = await prisma.permission.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PermissionUpdateArgs>(args: SelectSubset<T, PermissionUpdateArgs<ExtArgs>>): Prisma__PermissionClient<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Permissions.
     * @param {PermissionDeleteManyArgs} args - Arguments to filter Permissions to delete.
     * @example
     * // Delete a few Permissions
     * const { count } = await prisma.permission.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PermissionDeleteManyArgs>(args?: SelectSubset<T, PermissionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Permissions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PermissionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Permissions
     * const permission = await prisma.permission.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PermissionUpdateManyArgs>(args: SelectSubset<T, PermissionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Permission.
     * @param {PermissionUpsertArgs} args - Arguments to update or create a Permission.
     * @example
     * // Update or create a Permission
     * const permission = await prisma.permission.upsert({
     *   create: {
     *     // ... data to create a Permission
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Permission we want to update
     *   }
     * })
     */
    upsert<T extends PermissionUpsertArgs>(args: SelectSubset<T, PermissionUpsertArgs<ExtArgs>>): Prisma__PermissionClient<$Result.GetResult<Prisma.$PermissionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Permissions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PermissionCountArgs} args - Arguments to filter Permissions to count.
     * @example
     * // Count the number of Permissions
     * const count = await prisma.permission.count({
     *   where: {
     *     // ... the filter for the Permissions we want to count
     *   }
     * })
    **/
    count<T extends PermissionCountArgs>(
      args?: Subset<T, PermissionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PermissionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Permission.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PermissionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PermissionAggregateArgs>(args: Subset<T, PermissionAggregateArgs>): Prisma.PrismaPromise<GetPermissionAggregateType<T>>

    /**
     * Group by Permission.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PermissionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PermissionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PermissionGroupByArgs['orderBy'] }
        : { orderBy?: PermissionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PermissionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPermissionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Permission model
   */
  readonly fields: PermissionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Permission.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PermissionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Permission model
   */
  interface PermissionFieldRefs {
    readonly id: FieldRef<"Permission", 'Int'>
    readonly name: FieldRef<"Permission", 'String'>
    readonly category: FieldRef<"Permission", 'String'>
    readonly description: FieldRef<"Permission", 'String'>
    readonly allowedRoles: FieldRef<"Permission", 'String'>
    readonly createdAt: FieldRef<"Permission", 'DateTime'>
    readonly updatedAt: FieldRef<"Permission", 'DateTime'>
    readonly deleted: FieldRef<"Permission", 'Boolean'>
    readonly deletedAt: FieldRef<"Permission", 'DateTime'>
    readonly version: FieldRef<"Permission", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * Permission findUnique
   */
  export type PermissionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * Filter, which Permission to fetch.
     */
    where: PermissionWhereUniqueInput
  }

  /**
   * Permission findUniqueOrThrow
   */
  export type PermissionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * Filter, which Permission to fetch.
     */
    where: PermissionWhereUniqueInput
  }

  /**
   * Permission findFirst
   */
  export type PermissionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * Filter, which Permission to fetch.
     */
    where?: PermissionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Permissions to fetch.
     */
    orderBy?: PermissionOrderByWithRelationInput | PermissionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Permissions.
     */
    cursor?: PermissionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Permissions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Permissions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Permissions.
     */
    distinct?: PermissionScalarFieldEnum | PermissionScalarFieldEnum[]
  }

  /**
   * Permission findFirstOrThrow
   */
  export type PermissionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * Filter, which Permission to fetch.
     */
    where?: PermissionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Permissions to fetch.
     */
    orderBy?: PermissionOrderByWithRelationInput | PermissionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Permissions.
     */
    cursor?: PermissionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Permissions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Permissions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Permissions.
     */
    distinct?: PermissionScalarFieldEnum | PermissionScalarFieldEnum[]
  }

  /**
   * Permission findMany
   */
  export type PermissionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * Filter, which Permissions to fetch.
     */
    where?: PermissionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Permissions to fetch.
     */
    orderBy?: PermissionOrderByWithRelationInput | PermissionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Permissions.
     */
    cursor?: PermissionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Permissions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Permissions.
     */
    skip?: number
    distinct?: PermissionScalarFieldEnum | PermissionScalarFieldEnum[]
  }

  /**
   * Permission create
   */
  export type PermissionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * The data needed to create a Permission.
     */
    data: XOR<PermissionCreateInput, PermissionUncheckedCreateInput>
  }

  /**
   * Permission createMany
   */
  export type PermissionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Permissions.
     */
    data: PermissionCreateManyInput | PermissionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Permission update
   */
  export type PermissionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * The data needed to update a Permission.
     */
    data: XOR<PermissionUpdateInput, PermissionUncheckedUpdateInput>
    /**
     * Choose, which Permission to update.
     */
    where: PermissionWhereUniqueInput
  }

  /**
   * Permission updateMany
   */
  export type PermissionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Permissions.
     */
    data: XOR<PermissionUpdateManyMutationInput, PermissionUncheckedUpdateManyInput>
    /**
     * Filter which Permissions to update
     */
    where?: PermissionWhereInput
    /**
     * Limit how many Permissions to update.
     */
    limit?: number
  }

  /**
   * Permission upsert
   */
  export type PermissionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * The filter to search for the Permission to update in case it exists.
     */
    where: PermissionWhereUniqueInput
    /**
     * In case the Permission found by the `where` argument doesn't exist, create a new Permission with this data.
     */
    create: XOR<PermissionCreateInput, PermissionUncheckedCreateInput>
    /**
     * In case the Permission was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PermissionUpdateInput, PermissionUncheckedUpdateInput>
  }

  /**
   * Permission delete
   */
  export type PermissionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
    /**
     * Filter which Permission to delete.
     */
    where: PermissionWhereUniqueInput
  }

  /**
   * Permission deleteMany
   */
  export type PermissionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Permissions to delete
     */
    where?: PermissionWhereInput
    /**
     * Limit how many Permissions to delete.
     */
    limit?: number
  }

  /**
   * Permission without action
   */
  export type PermissionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Permission
     */
    select?: PermissionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Permission
     */
    omit?: PermissionOmit<ExtArgs> | null
  }


  /**
   * Model SettingDefinition
   */

  export type AggregateSettingDefinition = {
    _count: SettingDefinitionCountAggregateOutputType | null
    _avg: SettingDefinitionAvgAggregateOutputType | null
    _sum: SettingDefinitionSumAggregateOutputType | null
    _min: SettingDefinitionMinAggregateOutputType | null
    _max: SettingDefinitionMaxAggregateOutputType | null
  }

  export type SettingDefinitionAvgAggregateOutputType = {
    id: number | null
    version: number | null
  }

  export type SettingDefinitionSumAggregateOutputType = {
    id: number | null
    version: number | null
  }

  export type SettingDefinitionMinAggregateOutputType = {
    id: number | null
    key: string | null
    category: string | null
    type: string | null
    defaultValue: string | null
    description: string | null
    scope: string | null
    isRequired: boolean | null
    validationRules: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deleted: boolean | null
    deletedAt: Date | null
    version: number | null
  }

  export type SettingDefinitionMaxAggregateOutputType = {
    id: number | null
    key: string | null
    category: string | null
    type: string | null
    defaultValue: string | null
    description: string | null
    scope: string | null
    isRequired: boolean | null
    validationRules: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deleted: boolean | null
    deletedAt: Date | null
    version: number | null
  }

  export type SettingDefinitionCountAggregateOutputType = {
    id: number
    key: number
    category: number
    type: number
    defaultValue: number
    description: number
    scope: number
    isRequired: number
    validationRules: number
    createdAt: number
    updatedAt: number
    deleted: number
    deletedAt: number
    version: number
    _all: number
  }


  export type SettingDefinitionAvgAggregateInputType = {
    id?: true
    version?: true
  }

  export type SettingDefinitionSumAggregateInputType = {
    id?: true
    version?: true
  }

  export type SettingDefinitionMinAggregateInputType = {
    id?: true
    key?: true
    category?: true
    type?: true
    defaultValue?: true
    description?: true
    scope?: true
    isRequired?: true
    validationRules?: true
    createdAt?: true
    updatedAt?: true
    deleted?: true
    deletedAt?: true
    version?: true
  }

  export type SettingDefinitionMaxAggregateInputType = {
    id?: true
    key?: true
    category?: true
    type?: true
    defaultValue?: true
    description?: true
    scope?: true
    isRequired?: true
    validationRules?: true
    createdAt?: true
    updatedAt?: true
    deleted?: true
    deletedAt?: true
    version?: true
  }

  export type SettingDefinitionCountAggregateInputType = {
    id?: true
    key?: true
    category?: true
    type?: true
    defaultValue?: true
    description?: true
    scope?: true
    isRequired?: true
    validationRules?: true
    createdAt?: true
    updatedAt?: true
    deleted?: true
    deletedAt?: true
    version?: true
    _all?: true
  }

  export type SettingDefinitionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SettingDefinition to aggregate.
     */
    where?: SettingDefinitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SettingDefinitions to fetch.
     */
    orderBy?: SettingDefinitionOrderByWithRelationInput | SettingDefinitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SettingDefinitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SettingDefinitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SettingDefinitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SettingDefinitions
    **/
    _count?: true | SettingDefinitionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SettingDefinitionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SettingDefinitionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SettingDefinitionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SettingDefinitionMaxAggregateInputType
  }

  export type GetSettingDefinitionAggregateType<T extends SettingDefinitionAggregateArgs> = {
        [P in keyof T & keyof AggregateSettingDefinition]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSettingDefinition[P]>
      : GetScalarType<T[P], AggregateSettingDefinition[P]>
  }




  export type SettingDefinitionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SettingDefinitionWhereInput
    orderBy?: SettingDefinitionOrderByWithAggregationInput | SettingDefinitionOrderByWithAggregationInput[]
    by: SettingDefinitionScalarFieldEnum[] | SettingDefinitionScalarFieldEnum
    having?: SettingDefinitionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SettingDefinitionCountAggregateInputType | true
    _avg?: SettingDefinitionAvgAggregateInputType
    _sum?: SettingDefinitionSumAggregateInputType
    _min?: SettingDefinitionMinAggregateInputType
    _max?: SettingDefinitionMaxAggregateInputType
  }

  export type SettingDefinitionGroupByOutputType = {
    id: number
    key: string
    category: string
    type: string
    defaultValue: string | null
    description: string | null
    scope: string
    isRequired: boolean
    validationRules: string | null
    createdAt: Date
    updatedAt: Date
    deleted: boolean
    deletedAt: Date | null
    version: number
    _count: SettingDefinitionCountAggregateOutputType | null
    _avg: SettingDefinitionAvgAggregateOutputType | null
    _sum: SettingDefinitionSumAggregateOutputType | null
    _min: SettingDefinitionMinAggregateOutputType | null
    _max: SettingDefinitionMaxAggregateOutputType | null
  }

  type GetSettingDefinitionGroupByPayload<T extends SettingDefinitionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SettingDefinitionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SettingDefinitionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SettingDefinitionGroupByOutputType[P]>
            : GetScalarType<T[P], SettingDefinitionGroupByOutputType[P]>
        }
      >
    >


  export type SettingDefinitionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    category?: boolean
    type?: boolean
    defaultValue?: boolean
    description?: boolean
    scope?: boolean
    isRequired?: boolean
    validationRules?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deleted?: boolean
    deletedAt?: boolean
    version?: boolean
  }, ExtArgs["result"]["settingDefinition"]>



  export type SettingDefinitionSelectScalar = {
    id?: boolean
    key?: boolean
    category?: boolean
    type?: boolean
    defaultValue?: boolean
    description?: boolean
    scope?: boolean
    isRequired?: boolean
    validationRules?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deleted?: boolean
    deletedAt?: boolean
    version?: boolean
  }

  export type SettingDefinitionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "key" | "category" | "type" | "defaultValue" | "description" | "scope" | "isRequired" | "validationRules" | "createdAt" | "updatedAt" | "deleted" | "deletedAt" | "version", ExtArgs["result"]["settingDefinition"]>

  export type $SettingDefinitionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SettingDefinition"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: number
      key: string
      category: string
      type: string
      defaultValue: string | null
      description: string | null
      scope: string
      isRequired: boolean
      validationRules: string | null
      createdAt: Date
      updatedAt: Date
      deleted: boolean
      deletedAt: Date | null
      version: number
    }, ExtArgs["result"]["settingDefinition"]>
    composites: {}
  }

  type SettingDefinitionGetPayload<S extends boolean | null | undefined | SettingDefinitionDefaultArgs> = $Result.GetResult<Prisma.$SettingDefinitionPayload, S>

  type SettingDefinitionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SettingDefinitionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SettingDefinitionCountAggregateInputType | true
    }

  export interface SettingDefinitionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SettingDefinition'], meta: { name: 'SettingDefinition' } }
    /**
     * Find zero or one SettingDefinition that matches the filter.
     * @param {SettingDefinitionFindUniqueArgs} args - Arguments to find a SettingDefinition
     * @example
     * // Get one SettingDefinition
     * const settingDefinition = await prisma.settingDefinition.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SettingDefinitionFindUniqueArgs>(args: SelectSubset<T, SettingDefinitionFindUniqueArgs<ExtArgs>>): Prisma__SettingDefinitionClient<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SettingDefinition that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SettingDefinitionFindUniqueOrThrowArgs} args - Arguments to find a SettingDefinition
     * @example
     * // Get one SettingDefinition
     * const settingDefinition = await prisma.settingDefinition.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SettingDefinitionFindUniqueOrThrowArgs>(args: SelectSubset<T, SettingDefinitionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SettingDefinitionClient<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SettingDefinition that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SettingDefinitionFindFirstArgs} args - Arguments to find a SettingDefinition
     * @example
     * // Get one SettingDefinition
     * const settingDefinition = await prisma.settingDefinition.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SettingDefinitionFindFirstArgs>(args?: SelectSubset<T, SettingDefinitionFindFirstArgs<ExtArgs>>): Prisma__SettingDefinitionClient<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SettingDefinition that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SettingDefinitionFindFirstOrThrowArgs} args - Arguments to find a SettingDefinition
     * @example
     * // Get one SettingDefinition
     * const settingDefinition = await prisma.settingDefinition.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SettingDefinitionFindFirstOrThrowArgs>(args?: SelectSubset<T, SettingDefinitionFindFirstOrThrowArgs<ExtArgs>>): Prisma__SettingDefinitionClient<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SettingDefinitions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SettingDefinitionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SettingDefinitions
     * const settingDefinitions = await prisma.settingDefinition.findMany()
     * 
     * // Get first 10 SettingDefinitions
     * const settingDefinitions = await prisma.settingDefinition.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const settingDefinitionWithIdOnly = await prisma.settingDefinition.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SettingDefinitionFindManyArgs>(args?: SelectSubset<T, SettingDefinitionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SettingDefinition.
     * @param {SettingDefinitionCreateArgs} args - Arguments to create a SettingDefinition.
     * @example
     * // Create one SettingDefinition
     * const SettingDefinition = await prisma.settingDefinition.create({
     *   data: {
     *     // ... data to create a SettingDefinition
     *   }
     * })
     * 
     */
    create<T extends SettingDefinitionCreateArgs>(args: SelectSubset<T, SettingDefinitionCreateArgs<ExtArgs>>): Prisma__SettingDefinitionClient<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SettingDefinitions.
     * @param {SettingDefinitionCreateManyArgs} args - Arguments to create many SettingDefinitions.
     * @example
     * // Create many SettingDefinitions
     * const settingDefinition = await prisma.settingDefinition.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SettingDefinitionCreateManyArgs>(args?: SelectSubset<T, SettingDefinitionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a SettingDefinition.
     * @param {SettingDefinitionDeleteArgs} args - Arguments to delete one SettingDefinition.
     * @example
     * // Delete one SettingDefinition
     * const SettingDefinition = await prisma.settingDefinition.delete({
     *   where: {
     *     // ... filter to delete one SettingDefinition
     *   }
     * })
     * 
     */
    delete<T extends SettingDefinitionDeleteArgs>(args: SelectSubset<T, SettingDefinitionDeleteArgs<ExtArgs>>): Prisma__SettingDefinitionClient<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SettingDefinition.
     * @param {SettingDefinitionUpdateArgs} args - Arguments to update one SettingDefinition.
     * @example
     * // Update one SettingDefinition
     * const settingDefinition = await prisma.settingDefinition.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SettingDefinitionUpdateArgs>(args: SelectSubset<T, SettingDefinitionUpdateArgs<ExtArgs>>): Prisma__SettingDefinitionClient<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SettingDefinitions.
     * @param {SettingDefinitionDeleteManyArgs} args - Arguments to filter SettingDefinitions to delete.
     * @example
     * // Delete a few SettingDefinitions
     * const { count } = await prisma.settingDefinition.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SettingDefinitionDeleteManyArgs>(args?: SelectSubset<T, SettingDefinitionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SettingDefinitions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SettingDefinitionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SettingDefinitions
     * const settingDefinition = await prisma.settingDefinition.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SettingDefinitionUpdateManyArgs>(args: SelectSubset<T, SettingDefinitionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one SettingDefinition.
     * @param {SettingDefinitionUpsertArgs} args - Arguments to update or create a SettingDefinition.
     * @example
     * // Update or create a SettingDefinition
     * const settingDefinition = await prisma.settingDefinition.upsert({
     *   create: {
     *     // ... data to create a SettingDefinition
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SettingDefinition we want to update
     *   }
     * })
     */
    upsert<T extends SettingDefinitionUpsertArgs>(args: SelectSubset<T, SettingDefinitionUpsertArgs<ExtArgs>>): Prisma__SettingDefinitionClient<$Result.GetResult<Prisma.$SettingDefinitionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SettingDefinitions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SettingDefinitionCountArgs} args - Arguments to filter SettingDefinitions to count.
     * @example
     * // Count the number of SettingDefinitions
     * const count = await prisma.settingDefinition.count({
     *   where: {
     *     // ... the filter for the SettingDefinitions we want to count
     *   }
     * })
    **/
    count<T extends SettingDefinitionCountArgs>(
      args?: Subset<T, SettingDefinitionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SettingDefinitionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SettingDefinition.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SettingDefinitionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SettingDefinitionAggregateArgs>(args: Subset<T, SettingDefinitionAggregateArgs>): Prisma.PrismaPromise<GetSettingDefinitionAggregateType<T>>

    /**
     * Group by SettingDefinition.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SettingDefinitionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SettingDefinitionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SettingDefinitionGroupByArgs['orderBy'] }
        : { orderBy?: SettingDefinitionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SettingDefinitionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSettingDefinitionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SettingDefinition model
   */
  readonly fields: SettingDefinitionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SettingDefinition.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SettingDefinitionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SettingDefinition model
   */
  interface SettingDefinitionFieldRefs {
    readonly id: FieldRef<"SettingDefinition", 'Int'>
    readonly key: FieldRef<"SettingDefinition", 'String'>
    readonly category: FieldRef<"SettingDefinition", 'String'>
    readonly type: FieldRef<"SettingDefinition", 'String'>
    readonly defaultValue: FieldRef<"SettingDefinition", 'String'>
    readonly description: FieldRef<"SettingDefinition", 'String'>
    readonly scope: FieldRef<"SettingDefinition", 'String'>
    readonly isRequired: FieldRef<"SettingDefinition", 'Boolean'>
    readonly validationRules: FieldRef<"SettingDefinition", 'String'>
    readonly createdAt: FieldRef<"SettingDefinition", 'DateTime'>
    readonly updatedAt: FieldRef<"SettingDefinition", 'DateTime'>
    readonly deleted: FieldRef<"SettingDefinition", 'Boolean'>
    readonly deletedAt: FieldRef<"SettingDefinition", 'DateTime'>
    readonly version: FieldRef<"SettingDefinition", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * SettingDefinition findUnique
   */
  export type SettingDefinitionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * Filter, which SettingDefinition to fetch.
     */
    where: SettingDefinitionWhereUniqueInput
  }

  /**
   * SettingDefinition findUniqueOrThrow
   */
  export type SettingDefinitionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * Filter, which SettingDefinition to fetch.
     */
    where: SettingDefinitionWhereUniqueInput
  }

  /**
   * SettingDefinition findFirst
   */
  export type SettingDefinitionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * Filter, which SettingDefinition to fetch.
     */
    where?: SettingDefinitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SettingDefinitions to fetch.
     */
    orderBy?: SettingDefinitionOrderByWithRelationInput | SettingDefinitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SettingDefinitions.
     */
    cursor?: SettingDefinitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SettingDefinitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SettingDefinitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SettingDefinitions.
     */
    distinct?: SettingDefinitionScalarFieldEnum | SettingDefinitionScalarFieldEnum[]
  }

  /**
   * SettingDefinition findFirstOrThrow
   */
  export type SettingDefinitionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * Filter, which SettingDefinition to fetch.
     */
    where?: SettingDefinitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SettingDefinitions to fetch.
     */
    orderBy?: SettingDefinitionOrderByWithRelationInput | SettingDefinitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SettingDefinitions.
     */
    cursor?: SettingDefinitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SettingDefinitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SettingDefinitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SettingDefinitions.
     */
    distinct?: SettingDefinitionScalarFieldEnum | SettingDefinitionScalarFieldEnum[]
  }

  /**
   * SettingDefinition findMany
   */
  export type SettingDefinitionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * Filter, which SettingDefinitions to fetch.
     */
    where?: SettingDefinitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SettingDefinitions to fetch.
     */
    orderBy?: SettingDefinitionOrderByWithRelationInput | SettingDefinitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SettingDefinitions.
     */
    cursor?: SettingDefinitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SettingDefinitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SettingDefinitions.
     */
    skip?: number
    distinct?: SettingDefinitionScalarFieldEnum | SettingDefinitionScalarFieldEnum[]
  }

  /**
   * SettingDefinition create
   */
  export type SettingDefinitionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * The data needed to create a SettingDefinition.
     */
    data: XOR<SettingDefinitionCreateInput, SettingDefinitionUncheckedCreateInput>
  }

  /**
   * SettingDefinition createMany
   */
  export type SettingDefinitionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SettingDefinitions.
     */
    data: SettingDefinitionCreateManyInput | SettingDefinitionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SettingDefinition update
   */
  export type SettingDefinitionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * The data needed to update a SettingDefinition.
     */
    data: XOR<SettingDefinitionUpdateInput, SettingDefinitionUncheckedUpdateInput>
    /**
     * Choose, which SettingDefinition to update.
     */
    where: SettingDefinitionWhereUniqueInput
  }

  /**
   * SettingDefinition updateMany
   */
  export type SettingDefinitionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SettingDefinitions.
     */
    data: XOR<SettingDefinitionUpdateManyMutationInput, SettingDefinitionUncheckedUpdateManyInput>
    /**
     * Filter which SettingDefinitions to update
     */
    where?: SettingDefinitionWhereInput
    /**
     * Limit how many SettingDefinitions to update.
     */
    limit?: number
  }

  /**
   * SettingDefinition upsert
   */
  export type SettingDefinitionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * The filter to search for the SettingDefinition to update in case it exists.
     */
    where: SettingDefinitionWhereUniqueInput
    /**
     * In case the SettingDefinition found by the `where` argument doesn't exist, create a new SettingDefinition with this data.
     */
    create: XOR<SettingDefinitionCreateInput, SettingDefinitionUncheckedCreateInput>
    /**
     * In case the SettingDefinition was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SettingDefinitionUpdateInput, SettingDefinitionUncheckedUpdateInput>
  }

  /**
   * SettingDefinition delete
   */
  export type SettingDefinitionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
    /**
     * Filter which SettingDefinition to delete.
     */
    where: SettingDefinitionWhereUniqueInput
  }

  /**
   * SettingDefinition deleteMany
   */
  export type SettingDefinitionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SettingDefinitions to delete
     */
    where?: SettingDefinitionWhereInput
    /**
     * Limit how many SettingDefinitions to delete.
     */
    limit?: number
  }

  /**
   * SettingDefinition without action
   */
  export type SettingDefinitionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SettingDefinition
     */
    select?: SettingDefinitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SettingDefinition
     */
    omit?: SettingDefinitionOmit<ExtArgs> | null
  }


  /**
   * Model PushyDevice
   */

  export type AggregatePushyDevice = {
    _count: PushyDeviceCountAggregateOutputType | null
    _avg: PushyDeviceAvgAggregateOutputType | null
    _sum: PushyDeviceSumAggregateOutputType | null
    _min: PushyDeviceMinAggregateOutputType | null
    _max: PushyDeviceMaxAggregateOutputType | null
  }

  export type PushyDeviceAvgAggregateOutputType = {
    id: number | null
    tenantUserId: number | null
  }

  export type PushyDeviceSumAggregateOutputType = {
    id: number | null
    tenantUserId: number | null
  }

  export type PushyDeviceMinAggregateOutputType = {
    id: number | null
    tenantUserId: number | null
    deviceToken: string | null
    deviceFingerprint: string | null
    platform: string | null
    deviceName: string | null
    appVersion: string | null
    isActive: boolean | null
    lastActiveAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PushyDeviceMaxAggregateOutputType = {
    id: number | null
    tenantUserId: number | null
    deviceToken: string | null
    deviceFingerprint: string | null
    platform: string | null
    deviceName: string | null
    appVersion: string | null
    isActive: boolean | null
    lastActiveAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PushyDeviceCountAggregateOutputType = {
    id: number
    tenantUserId: number
    deviceToken: number
    deviceFingerprint: number
    platform: number
    deviceName: number
    appVersion: number
    isActive: number
    lastActiveAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PushyDeviceAvgAggregateInputType = {
    id?: true
    tenantUserId?: true
  }

  export type PushyDeviceSumAggregateInputType = {
    id?: true
    tenantUserId?: true
  }

  export type PushyDeviceMinAggregateInputType = {
    id?: true
    tenantUserId?: true
    deviceToken?: true
    deviceFingerprint?: true
    platform?: true
    deviceName?: true
    appVersion?: true
    isActive?: true
    lastActiveAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PushyDeviceMaxAggregateInputType = {
    id?: true
    tenantUserId?: true
    deviceToken?: true
    deviceFingerprint?: true
    platform?: true
    deviceName?: true
    appVersion?: true
    isActive?: true
    lastActiveAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PushyDeviceCountAggregateInputType = {
    id?: true
    tenantUserId?: true
    deviceToken?: true
    deviceFingerprint?: true
    platform?: true
    deviceName?: true
    appVersion?: true
    isActive?: true
    lastActiveAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PushyDeviceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PushyDevice to aggregate.
     */
    where?: PushyDeviceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushyDevices to fetch.
     */
    orderBy?: PushyDeviceOrderByWithRelationInput | PushyDeviceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PushyDeviceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushyDevices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushyDevices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PushyDevices
    **/
    _count?: true | PushyDeviceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PushyDeviceAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PushyDeviceSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PushyDeviceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PushyDeviceMaxAggregateInputType
  }

  export type GetPushyDeviceAggregateType<T extends PushyDeviceAggregateArgs> = {
        [P in keyof T & keyof AggregatePushyDevice]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePushyDevice[P]>
      : GetScalarType<T[P], AggregatePushyDevice[P]>
  }




  export type PushyDeviceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PushyDeviceWhereInput
    orderBy?: PushyDeviceOrderByWithAggregationInput | PushyDeviceOrderByWithAggregationInput[]
    by: PushyDeviceScalarFieldEnum[] | PushyDeviceScalarFieldEnum
    having?: PushyDeviceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PushyDeviceCountAggregateInputType | true
    _avg?: PushyDeviceAvgAggregateInputType
    _sum?: PushyDeviceSumAggregateInputType
    _min?: PushyDeviceMinAggregateInputType
    _max?: PushyDeviceMaxAggregateInputType
  }

  export type PushyDeviceGroupByOutputType = {
    id: number
    tenantUserId: number
    deviceToken: string
    deviceFingerprint: string | null
    platform: string
    deviceName: string | null
    appVersion: string | null
    isActive: boolean
    lastActiveAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: PushyDeviceCountAggregateOutputType | null
    _avg: PushyDeviceAvgAggregateOutputType | null
    _sum: PushyDeviceSumAggregateOutputType | null
    _min: PushyDeviceMinAggregateOutputType | null
    _max: PushyDeviceMaxAggregateOutputType | null
  }

  type GetPushyDeviceGroupByPayload<T extends PushyDeviceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PushyDeviceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PushyDeviceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PushyDeviceGroupByOutputType[P]>
            : GetScalarType<T[P], PushyDeviceGroupByOutputType[P]>
        }
      >
    >


  export type PushyDeviceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantUserId?: boolean
    deviceToken?: boolean
    deviceFingerprint?: boolean
    platform?: boolean
    deviceName?: boolean
    appVersion?: boolean
    isActive?: boolean
    lastActiveAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    tenantUser?: boolean | TenantUserDefaultArgs<ExtArgs>
    subscriptions?: boolean | PushyDevice$subscriptionsArgs<ExtArgs>
    allocation?: boolean | PushyDevice$allocationArgs<ExtArgs>
    _count?: boolean | PushyDeviceCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pushyDevice"]>



  export type PushyDeviceSelectScalar = {
    id?: boolean
    tenantUserId?: boolean
    deviceToken?: boolean
    deviceFingerprint?: boolean
    platform?: boolean
    deviceName?: boolean
    appVersion?: boolean
    isActive?: boolean
    lastActiveAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PushyDeviceOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "tenantUserId" | "deviceToken" | "deviceFingerprint" | "platform" | "deviceName" | "appVersion" | "isActive" | "lastActiveAt" | "createdAt" | "updatedAt", ExtArgs["result"]["pushyDevice"]>
  export type PushyDeviceInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    tenantUser?: boolean | TenantUserDefaultArgs<ExtArgs>
    subscriptions?: boolean | PushyDevice$subscriptionsArgs<ExtArgs>
    allocation?: boolean | PushyDevice$allocationArgs<ExtArgs>
    _count?: boolean | PushyDeviceCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $PushyDevicePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PushyDevice"
    objects: {
      tenantUser: Prisma.$TenantUserPayload<ExtArgs>
      subscriptions: Prisma.$PushySubscriptionPayload<ExtArgs>[]
      allocation: Prisma.$PushyDeviceAllocationPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      tenantUserId: number
      deviceToken: string
      deviceFingerprint: string | null
      platform: string
      deviceName: string | null
      appVersion: string | null
      isActive: boolean
      lastActiveAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pushyDevice"]>
    composites: {}
  }

  type PushyDeviceGetPayload<S extends boolean | null | undefined | PushyDeviceDefaultArgs> = $Result.GetResult<Prisma.$PushyDevicePayload, S>

  type PushyDeviceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PushyDeviceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PushyDeviceCountAggregateInputType | true
    }

  export interface PushyDeviceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PushyDevice'], meta: { name: 'PushyDevice' } }
    /**
     * Find zero or one PushyDevice that matches the filter.
     * @param {PushyDeviceFindUniqueArgs} args - Arguments to find a PushyDevice
     * @example
     * // Get one PushyDevice
     * const pushyDevice = await prisma.pushyDevice.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PushyDeviceFindUniqueArgs>(args: SelectSubset<T, PushyDeviceFindUniqueArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PushyDevice that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PushyDeviceFindUniqueOrThrowArgs} args - Arguments to find a PushyDevice
     * @example
     * // Get one PushyDevice
     * const pushyDevice = await prisma.pushyDevice.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PushyDeviceFindUniqueOrThrowArgs>(args: SelectSubset<T, PushyDeviceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PushyDevice that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceFindFirstArgs} args - Arguments to find a PushyDevice
     * @example
     * // Get one PushyDevice
     * const pushyDevice = await prisma.pushyDevice.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PushyDeviceFindFirstArgs>(args?: SelectSubset<T, PushyDeviceFindFirstArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PushyDevice that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceFindFirstOrThrowArgs} args - Arguments to find a PushyDevice
     * @example
     * // Get one PushyDevice
     * const pushyDevice = await prisma.pushyDevice.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PushyDeviceFindFirstOrThrowArgs>(args?: SelectSubset<T, PushyDeviceFindFirstOrThrowArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PushyDevices that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PushyDevices
     * const pushyDevices = await prisma.pushyDevice.findMany()
     * 
     * // Get first 10 PushyDevices
     * const pushyDevices = await prisma.pushyDevice.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pushyDeviceWithIdOnly = await prisma.pushyDevice.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PushyDeviceFindManyArgs>(args?: SelectSubset<T, PushyDeviceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PushyDevice.
     * @param {PushyDeviceCreateArgs} args - Arguments to create a PushyDevice.
     * @example
     * // Create one PushyDevice
     * const PushyDevice = await prisma.pushyDevice.create({
     *   data: {
     *     // ... data to create a PushyDevice
     *   }
     * })
     * 
     */
    create<T extends PushyDeviceCreateArgs>(args: SelectSubset<T, PushyDeviceCreateArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PushyDevices.
     * @param {PushyDeviceCreateManyArgs} args - Arguments to create many PushyDevices.
     * @example
     * // Create many PushyDevices
     * const pushyDevice = await prisma.pushyDevice.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PushyDeviceCreateManyArgs>(args?: SelectSubset<T, PushyDeviceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a PushyDevice.
     * @param {PushyDeviceDeleteArgs} args - Arguments to delete one PushyDevice.
     * @example
     * // Delete one PushyDevice
     * const PushyDevice = await prisma.pushyDevice.delete({
     *   where: {
     *     // ... filter to delete one PushyDevice
     *   }
     * })
     * 
     */
    delete<T extends PushyDeviceDeleteArgs>(args: SelectSubset<T, PushyDeviceDeleteArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PushyDevice.
     * @param {PushyDeviceUpdateArgs} args - Arguments to update one PushyDevice.
     * @example
     * // Update one PushyDevice
     * const pushyDevice = await prisma.pushyDevice.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PushyDeviceUpdateArgs>(args: SelectSubset<T, PushyDeviceUpdateArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PushyDevices.
     * @param {PushyDeviceDeleteManyArgs} args - Arguments to filter PushyDevices to delete.
     * @example
     * // Delete a few PushyDevices
     * const { count } = await prisma.pushyDevice.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PushyDeviceDeleteManyArgs>(args?: SelectSubset<T, PushyDeviceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PushyDevices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PushyDevices
     * const pushyDevice = await prisma.pushyDevice.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PushyDeviceUpdateManyArgs>(args: SelectSubset<T, PushyDeviceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PushyDevice.
     * @param {PushyDeviceUpsertArgs} args - Arguments to update or create a PushyDevice.
     * @example
     * // Update or create a PushyDevice
     * const pushyDevice = await prisma.pushyDevice.upsert({
     *   create: {
     *     // ... data to create a PushyDevice
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PushyDevice we want to update
     *   }
     * })
     */
    upsert<T extends PushyDeviceUpsertArgs>(args: SelectSubset<T, PushyDeviceUpsertArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PushyDevices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceCountArgs} args - Arguments to filter PushyDevices to count.
     * @example
     * // Count the number of PushyDevices
     * const count = await prisma.pushyDevice.count({
     *   where: {
     *     // ... the filter for the PushyDevices we want to count
     *   }
     * })
    **/
    count<T extends PushyDeviceCountArgs>(
      args?: Subset<T, PushyDeviceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PushyDeviceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PushyDevice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PushyDeviceAggregateArgs>(args: Subset<T, PushyDeviceAggregateArgs>): Prisma.PrismaPromise<GetPushyDeviceAggregateType<T>>

    /**
     * Group by PushyDevice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PushyDeviceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PushyDeviceGroupByArgs['orderBy'] }
        : { orderBy?: PushyDeviceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PushyDeviceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPushyDeviceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PushyDevice model
   */
  readonly fields: PushyDeviceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PushyDevice.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PushyDeviceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    tenantUser<T extends TenantUserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TenantUserDefaultArgs<ExtArgs>>): Prisma__TenantUserClient<$Result.GetResult<Prisma.$TenantUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    subscriptions<T extends PushyDevice$subscriptionsArgs<ExtArgs> = {}>(args?: Subset<T, PushyDevice$subscriptionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    allocation<T extends PushyDevice$allocationArgs<ExtArgs> = {}>(args?: Subset<T, PushyDevice$allocationArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PushyDevice model
   */
  interface PushyDeviceFieldRefs {
    readonly id: FieldRef<"PushyDevice", 'Int'>
    readonly tenantUserId: FieldRef<"PushyDevice", 'Int'>
    readonly deviceToken: FieldRef<"PushyDevice", 'String'>
    readonly deviceFingerprint: FieldRef<"PushyDevice", 'String'>
    readonly platform: FieldRef<"PushyDevice", 'String'>
    readonly deviceName: FieldRef<"PushyDevice", 'String'>
    readonly appVersion: FieldRef<"PushyDevice", 'String'>
    readonly isActive: FieldRef<"PushyDevice", 'Boolean'>
    readonly lastActiveAt: FieldRef<"PushyDevice", 'DateTime'>
    readonly createdAt: FieldRef<"PushyDevice", 'DateTime'>
    readonly updatedAt: FieldRef<"PushyDevice", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PushyDevice findUnique
   */
  export type PushyDeviceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * Filter, which PushyDevice to fetch.
     */
    where: PushyDeviceWhereUniqueInput
  }

  /**
   * PushyDevice findUniqueOrThrow
   */
  export type PushyDeviceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * Filter, which PushyDevice to fetch.
     */
    where: PushyDeviceWhereUniqueInput
  }

  /**
   * PushyDevice findFirst
   */
  export type PushyDeviceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * Filter, which PushyDevice to fetch.
     */
    where?: PushyDeviceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushyDevices to fetch.
     */
    orderBy?: PushyDeviceOrderByWithRelationInput | PushyDeviceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PushyDevices.
     */
    cursor?: PushyDeviceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushyDevices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushyDevices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PushyDevices.
     */
    distinct?: PushyDeviceScalarFieldEnum | PushyDeviceScalarFieldEnum[]
  }

  /**
   * PushyDevice findFirstOrThrow
   */
  export type PushyDeviceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * Filter, which PushyDevice to fetch.
     */
    where?: PushyDeviceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushyDevices to fetch.
     */
    orderBy?: PushyDeviceOrderByWithRelationInput | PushyDeviceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PushyDevices.
     */
    cursor?: PushyDeviceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushyDevices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushyDevices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PushyDevices.
     */
    distinct?: PushyDeviceScalarFieldEnum | PushyDeviceScalarFieldEnum[]
  }

  /**
   * PushyDevice findMany
   */
  export type PushyDeviceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * Filter, which PushyDevices to fetch.
     */
    where?: PushyDeviceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushyDevices to fetch.
     */
    orderBy?: PushyDeviceOrderByWithRelationInput | PushyDeviceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PushyDevices.
     */
    cursor?: PushyDeviceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushyDevices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushyDevices.
     */
    skip?: number
    distinct?: PushyDeviceScalarFieldEnum | PushyDeviceScalarFieldEnum[]
  }

  /**
   * PushyDevice create
   */
  export type PushyDeviceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * The data needed to create a PushyDevice.
     */
    data: XOR<PushyDeviceCreateInput, PushyDeviceUncheckedCreateInput>
  }

  /**
   * PushyDevice createMany
   */
  export type PushyDeviceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PushyDevices.
     */
    data: PushyDeviceCreateManyInput | PushyDeviceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PushyDevice update
   */
  export type PushyDeviceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * The data needed to update a PushyDevice.
     */
    data: XOR<PushyDeviceUpdateInput, PushyDeviceUncheckedUpdateInput>
    /**
     * Choose, which PushyDevice to update.
     */
    where: PushyDeviceWhereUniqueInput
  }

  /**
   * PushyDevice updateMany
   */
  export type PushyDeviceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PushyDevices.
     */
    data: XOR<PushyDeviceUpdateManyMutationInput, PushyDeviceUncheckedUpdateManyInput>
    /**
     * Filter which PushyDevices to update
     */
    where?: PushyDeviceWhereInput
    /**
     * Limit how many PushyDevices to update.
     */
    limit?: number
  }

  /**
   * PushyDevice upsert
   */
  export type PushyDeviceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * The filter to search for the PushyDevice to update in case it exists.
     */
    where: PushyDeviceWhereUniqueInput
    /**
     * In case the PushyDevice found by the `where` argument doesn't exist, create a new PushyDevice with this data.
     */
    create: XOR<PushyDeviceCreateInput, PushyDeviceUncheckedCreateInput>
    /**
     * In case the PushyDevice was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PushyDeviceUpdateInput, PushyDeviceUncheckedUpdateInput>
  }

  /**
   * PushyDevice delete
   */
  export type PushyDeviceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
    /**
     * Filter which PushyDevice to delete.
     */
    where: PushyDeviceWhereUniqueInput
  }

  /**
   * PushyDevice deleteMany
   */
  export type PushyDeviceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PushyDevices to delete
     */
    where?: PushyDeviceWhereInput
    /**
     * Limit how many PushyDevices to delete.
     */
    limit?: number
  }

  /**
   * PushyDevice.subscriptions
   */
  export type PushyDevice$subscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    where?: PushySubscriptionWhereInput
    orderBy?: PushySubscriptionOrderByWithRelationInput | PushySubscriptionOrderByWithRelationInput[]
    cursor?: PushySubscriptionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PushySubscriptionScalarFieldEnum | PushySubscriptionScalarFieldEnum[]
  }

  /**
   * PushyDevice.allocation
   */
  export type PushyDevice$allocationArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    where?: PushyDeviceAllocationWhereInput
  }

  /**
   * PushyDevice without action
   */
  export type PushyDeviceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDevice
     */
    select?: PushyDeviceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDevice
     */
    omit?: PushyDeviceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceInclude<ExtArgs> | null
  }


  /**
   * Model PushySubscription
   */

  export type AggregatePushySubscription = {
    _count: PushySubscriptionCountAggregateOutputType | null
    _avg: PushySubscriptionAvgAggregateOutputType | null
    _sum: PushySubscriptionSumAggregateOutputType | null
    _min: PushySubscriptionMinAggregateOutputType | null
    _max: PushySubscriptionMaxAggregateOutputType | null
  }

  export type PushySubscriptionAvgAggregateOutputType = {
    id: number | null
    deviceId: number | null
  }

  export type PushySubscriptionSumAggregateOutputType = {
    id: number | null
    deviceId: number | null
  }

  export type PushySubscriptionMinAggregateOutputType = {
    id: number | null
    deviceId: number | null
    topic: string | null
    subscribedAt: Date | null
  }

  export type PushySubscriptionMaxAggregateOutputType = {
    id: number | null
    deviceId: number | null
    topic: string | null
    subscribedAt: Date | null
  }

  export type PushySubscriptionCountAggregateOutputType = {
    id: number
    deviceId: number
    topic: number
    subscribedAt: number
    _all: number
  }


  export type PushySubscriptionAvgAggregateInputType = {
    id?: true
    deviceId?: true
  }

  export type PushySubscriptionSumAggregateInputType = {
    id?: true
    deviceId?: true
  }

  export type PushySubscriptionMinAggregateInputType = {
    id?: true
    deviceId?: true
    topic?: true
    subscribedAt?: true
  }

  export type PushySubscriptionMaxAggregateInputType = {
    id?: true
    deviceId?: true
    topic?: true
    subscribedAt?: true
  }

  export type PushySubscriptionCountAggregateInputType = {
    id?: true
    deviceId?: true
    topic?: true
    subscribedAt?: true
    _all?: true
  }

  export type PushySubscriptionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PushySubscription to aggregate.
     */
    where?: PushySubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushySubscriptions to fetch.
     */
    orderBy?: PushySubscriptionOrderByWithRelationInput | PushySubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PushySubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushySubscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushySubscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PushySubscriptions
    **/
    _count?: true | PushySubscriptionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PushySubscriptionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PushySubscriptionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PushySubscriptionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PushySubscriptionMaxAggregateInputType
  }

  export type GetPushySubscriptionAggregateType<T extends PushySubscriptionAggregateArgs> = {
        [P in keyof T & keyof AggregatePushySubscription]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePushySubscription[P]>
      : GetScalarType<T[P], AggregatePushySubscription[P]>
  }




  export type PushySubscriptionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PushySubscriptionWhereInput
    orderBy?: PushySubscriptionOrderByWithAggregationInput | PushySubscriptionOrderByWithAggregationInput[]
    by: PushySubscriptionScalarFieldEnum[] | PushySubscriptionScalarFieldEnum
    having?: PushySubscriptionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PushySubscriptionCountAggregateInputType | true
    _avg?: PushySubscriptionAvgAggregateInputType
    _sum?: PushySubscriptionSumAggregateInputType
    _min?: PushySubscriptionMinAggregateInputType
    _max?: PushySubscriptionMaxAggregateInputType
  }

  export type PushySubscriptionGroupByOutputType = {
    id: number
    deviceId: number
    topic: string
    subscribedAt: Date
    _count: PushySubscriptionCountAggregateOutputType | null
    _avg: PushySubscriptionAvgAggregateOutputType | null
    _sum: PushySubscriptionSumAggregateOutputType | null
    _min: PushySubscriptionMinAggregateOutputType | null
    _max: PushySubscriptionMaxAggregateOutputType | null
  }

  type GetPushySubscriptionGroupByPayload<T extends PushySubscriptionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PushySubscriptionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PushySubscriptionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PushySubscriptionGroupByOutputType[P]>
            : GetScalarType<T[P], PushySubscriptionGroupByOutputType[P]>
        }
      >
    >


  export type PushySubscriptionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    deviceId?: boolean
    topic?: boolean
    subscribedAt?: boolean
    device?: boolean | PushyDeviceDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pushySubscription"]>



  export type PushySubscriptionSelectScalar = {
    id?: boolean
    deviceId?: boolean
    topic?: boolean
    subscribedAt?: boolean
  }

  export type PushySubscriptionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "deviceId" | "topic" | "subscribedAt", ExtArgs["result"]["pushySubscription"]>
  export type PushySubscriptionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    device?: boolean | PushyDeviceDefaultArgs<ExtArgs>
  }

  export type $PushySubscriptionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PushySubscription"
    objects: {
      device: Prisma.$PushyDevicePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      deviceId: number
      topic: string
      subscribedAt: Date
    }, ExtArgs["result"]["pushySubscription"]>
    composites: {}
  }

  type PushySubscriptionGetPayload<S extends boolean | null | undefined | PushySubscriptionDefaultArgs> = $Result.GetResult<Prisma.$PushySubscriptionPayload, S>

  type PushySubscriptionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PushySubscriptionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PushySubscriptionCountAggregateInputType | true
    }

  export interface PushySubscriptionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PushySubscription'], meta: { name: 'PushySubscription' } }
    /**
     * Find zero or one PushySubscription that matches the filter.
     * @param {PushySubscriptionFindUniqueArgs} args - Arguments to find a PushySubscription
     * @example
     * // Get one PushySubscription
     * const pushySubscription = await prisma.pushySubscription.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PushySubscriptionFindUniqueArgs>(args: SelectSubset<T, PushySubscriptionFindUniqueArgs<ExtArgs>>): Prisma__PushySubscriptionClient<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PushySubscription that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PushySubscriptionFindUniqueOrThrowArgs} args - Arguments to find a PushySubscription
     * @example
     * // Get one PushySubscription
     * const pushySubscription = await prisma.pushySubscription.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PushySubscriptionFindUniqueOrThrowArgs>(args: SelectSubset<T, PushySubscriptionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PushySubscriptionClient<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PushySubscription that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushySubscriptionFindFirstArgs} args - Arguments to find a PushySubscription
     * @example
     * // Get one PushySubscription
     * const pushySubscription = await prisma.pushySubscription.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PushySubscriptionFindFirstArgs>(args?: SelectSubset<T, PushySubscriptionFindFirstArgs<ExtArgs>>): Prisma__PushySubscriptionClient<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PushySubscription that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushySubscriptionFindFirstOrThrowArgs} args - Arguments to find a PushySubscription
     * @example
     * // Get one PushySubscription
     * const pushySubscription = await prisma.pushySubscription.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PushySubscriptionFindFirstOrThrowArgs>(args?: SelectSubset<T, PushySubscriptionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PushySubscriptionClient<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PushySubscriptions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushySubscriptionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PushySubscriptions
     * const pushySubscriptions = await prisma.pushySubscription.findMany()
     * 
     * // Get first 10 PushySubscriptions
     * const pushySubscriptions = await prisma.pushySubscription.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pushySubscriptionWithIdOnly = await prisma.pushySubscription.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PushySubscriptionFindManyArgs>(args?: SelectSubset<T, PushySubscriptionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PushySubscription.
     * @param {PushySubscriptionCreateArgs} args - Arguments to create a PushySubscription.
     * @example
     * // Create one PushySubscription
     * const PushySubscription = await prisma.pushySubscription.create({
     *   data: {
     *     // ... data to create a PushySubscription
     *   }
     * })
     * 
     */
    create<T extends PushySubscriptionCreateArgs>(args: SelectSubset<T, PushySubscriptionCreateArgs<ExtArgs>>): Prisma__PushySubscriptionClient<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PushySubscriptions.
     * @param {PushySubscriptionCreateManyArgs} args - Arguments to create many PushySubscriptions.
     * @example
     * // Create many PushySubscriptions
     * const pushySubscription = await prisma.pushySubscription.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PushySubscriptionCreateManyArgs>(args?: SelectSubset<T, PushySubscriptionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a PushySubscription.
     * @param {PushySubscriptionDeleteArgs} args - Arguments to delete one PushySubscription.
     * @example
     * // Delete one PushySubscription
     * const PushySubscription = await prisma.pushySubscription.delete({
     *   where: {
     *     // ... filter to delete one PushySubscription
     *   }
     * })
     * 
     */
    delete<T extends PushySubscriptionDeleteArgs>(args: SelectSubset<T, PushySubscriptionDeleteArgs<ExtArgs>>): Prisma__PushySubscriptionClient<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PushySubscription.
     * @param {PushySubscriptionUpdateArgs} args - Arguments to update one PushySubscription.
     * @example
     * // Update one PushySubscription
     * const pushySubscription = await prisma.pushySubscription.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PushySubscriptionUpdateArgs>(args: SelectSubset<T, PushySubscriptionUpdateArgs<ExtArgs>>): Prisma__PushySubscriptionClient<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PushySubscriptions.
     * @param {PushySubscriptionDeleteManyArgs} args - Arguments to filter PushySubscriptions to delete.
     * @example
     * // Delete a few PushySubscriptions
     * const { count } = await prisma.pushySubscription.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PushySubscriptionDeleteManyArgs>(args?: SelectSubset<T, PushySubscriptionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PushySubscriptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushySubscriptionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PushySubscriptions
     * const pushySubscription = await prisma.pushySubscription.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PushySubscriptionUpdateManyArgs>(args: SelectSubset<T, PushySubscriptionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PushySubscription.
     * @param {PushySubscriptionUpsertArgs} args - Arguments to update or create a PushySubscription.
     * @example
     * // Update or create a PushySubscription
     * const pushySubscription = await prisma.pushySubscription.upsert({
     *   create: {
     *     // ... data to create a PushySubscription
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PushySubscription we want to update
     *   }
     * })
     */
    upsert<T extends PushySubscriptionUpsertArgs>(args: SelectSubset<T, PushySubscriptionUpsertArgs<ExtArgs>>): Prisma__PushySubscriptionClient<$Result.GetResult<Prisma.$PushySubscriptionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PushySubscriptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushySubscriptionCountArgs} args - Arguments to filter PushySubscriptions to count.
     * @example
     * // Count the number of PushySubscriptions
     * const count = await prisma.pushySubscription.count({
     *   where: {
     *     // ... the filter for the PushySubscriptions we want to count
     *   }
     * })
    **/
    count<T extends PushySubscriptionCountArgs>(
      args?: Subset<T, PushySubscriptionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PushySubscriptionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PushySubscription.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushySubscriptionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PushySubscriptionAggregateArgs>(args: Subset<T, PushySubscriptionAggregateArgs>): Prisma.PrismaPromise<GetPushySubscriptionAggregateType<T>>

    /**
     * Group by PushySubscription.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushySubscriptionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PushySubscriptionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PushySubscriptionGroupByArgs['orderBy'] }
        : { orderBy?: PushySubscriptionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PushySubscriptionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPushySubscriptionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PushySubscription model
   */
  readonly fields: PushySubscriptionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PushySubscription.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PushySubscriptionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    device<T extends PushyDeviceDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PushyDeviceDefaultArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PushySubscription model
   */
  interface PushySubscriptionFieldRefs {
    readonly id: FieldRef<"PushySubscription", 'Int'>
    readonly deviceId: FieldRef<"PushySubscription", 'Int'>
    readonly topic: FieldRef<"PushySubscription", 'String'>
    readonly subscribedAt: FieldRef<"PushySubscription", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PushySubscription findUnique
   */
  export type PushySubscriptionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which PushySubscription to fetch.
     */
    where: PushySubscriptionWhereUniqueInput
  }

  /**
   * PushySubscription findUniqueOrThrow
   */
  export type PushySubscriptionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which PushySubscription to fetch.
     */
    where: PushySubscriptionWhereUniqueInput
  }

  /**
   * PushySubscription findFirst
   */
  export type PushySubscriptionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which PushySubscription to fetch.
     */
    where?: PushySubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushySubscriptions to fetch.
     */
    orderBy?: PushySubscriptionOrderByWithRelationInput | PushySubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PushySubscriptions.
     */
    cursor?: PushySubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushySubscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushySubscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PushySubscriptions.
     */
    distinct?: PushySubscriptionScalarFieldEnum | PushySubscriptionScalarFieldEnum[]
  }

  /**
   * PushySubscription findFirstOrThrow
   */
  export type PushySubscriptionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which PushySubscription to fetch.
     */
    where?: PushySubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushySubscriptions to fetch.
     */
    orderBy?: PushySubscriptionOrderByWithRelationInput | PushySubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PushySubscriptions.
     */
    cursor?: PushySubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushySubscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushySubscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PushySubscriptions.
     */
    distinct?: PushySubscriptionScalarFieldEnum | PushySubscriptionScalarFieldEnum[]
  }

  /**
   * PushySubscription findMany
   */
  export type PushySubscriptionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which PushySubscriptions to fetch.
     */
    where?: PushySubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushySubscriptions to fetch.
     */
    orderBy?: PushySubscriptionOrderByWithRelationInput | PushySubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PushySubscriptions.
     */
    cursor?: PushySubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushySubscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushySubscriptions.
     */
    skip?: number
    distinct?: PushySubscriptionScalarFieldEnum | PushySubscriptionScalarFieldEnum[]
  }

  /**
   * PushySubscription create
   */
  export type PushySubscriptionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * The data needed to create a PushySubscription.
     */
    data: XOR<PushySubscriptionCreateInput, PushySubscriptionUncheckedCreateInput>
  }

  /**
   * PushySubscription createMany
   */
  export type PushySubscriptionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PushySubscriptions.
     */
    data: PushySubscriptionCreateManyInput | PushySubscriptionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PushySubscription update
   */
  export type PushySubscriptionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * The data needed to update a PushySubscription.
     */
    data: XOR<PushySubscriptionUpdateInput, PushySubscriptionUncheckedUpdateInput>
    /**
     * Choose, which PushySubscription to update.
     */
    where: PushySubscriptionWhereUniqueInput
  }

  /**
   * PushySubscription updateMany
   */
  export type PushySubscriptionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PushySubscriptions.
     */
    data: XOR<PushySubscriptionUpdateManyMutationInput, PushySubscriptionUncheckedUpdateManyInput>
    /**
     * Filter which PushySubscriptions to update
     */
    where?: PushySubscriptionWhereInput
    /**
     * Limit how many PushySubscriptions to update.
     */
    limit?: number
  }

  /**
   * PushySubscription upsert
   */
  export type PushySubscriptionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * The filter to search for the PushySubscription to update in case it exists.
     */
    where: PushySubscriptionWhereUniqueInput
    /**
     * In case the PushySubscription found by the `where` argument doesn't exist, create a new PushySubscription with this data.
     */
    create: XOR<PushySubscriptionCreateInput, PushySubscriptionUncheckedCreateInput>
    /**
     * In case the PushySubscription was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PushySubscriptionUpdateInput, PushySubscriptionUncheckedUpdateInput>
  }

  /**
   * PushySubscription delete
   */
  export type PushySubscriptionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
    /**
     * Filter which PushySubscription to delete.
     */
    where: PushySubscriptionWhereUniqueInput
  }

  /**
   * PushySubscription deleteMany
   */
  export type PushySubscriptionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PushySubscriptions to delete
     */
    where?: PushySubscriptionWhereInput
    /**
     * Limit how many PushySubscriptions to delete.
     */
    limit?: number
  }

  /**
   * PushySubscription without action
   */
  export type PushySubscriptionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushySubscription
     */
    select?: PushySubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushySubscription
     */
    omit?: PushySubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushySubscriptionInclude<ExtArgs> | null
  }


  /**
   * Model PushyDeviceAllocation
   */

  export type AggregatePushyDeviceAllocation = {
    _count: PushyDeviceAllocationCountAggregateOutputType | null
    _avg: PushyDeviceAllocationAvgAggregateOutputType | null
    _sum: PushyDeviceAllocationSumAggregateOutputType | null
    _min: PushyDeviceAllocationMinAggregateOutputType | null
    _max: PushyDeviceAllocationMaxAggregateOutputType | null
  }

  export type PushyDeviceAllocationAvgAggregateOutputType = {
    id: number | null
    deviceId: number | null
    tenantId: number | null
    subscriptionId: number | null
    addOnId: number | null
  }

  export type PushyDeviceAllocationSumAggregateOutputType = {
    id: number | null
    deviceId: number | null
    tenantId: number | null
    subscriptionId: number | null
    addOnId: number | null
  }

  export type PushyDeviceAllocationMinAggregateOutputType = {
    id: number | null
    deviceId: number | null
    tenantId: number | null
    subscriptionId: number | null
    addOnId: number | null
    allocationType: string | null
    activatedAt: Date | null
    expiresAt: Date | null
    createdAt: Date | null
  }

  export type PushyDeviceAllocationMaxAggregateOutputType = {
    id: number | null
    deviceId: number | null
    tenantId: number | null
    subscriptionId: number | null
    addOnId: number | null
    allocationType: string | null
    activatedAt: Date | null
    expiresAt: Date | null
    createdAt: Date | null
  }

  export type PushyDeviceAllocationCountAggregateOutputType = {
    id: number
    deviceId: number
    tenantId: number
    subscriptionId: number
    addOnId: number
    allocationType: number
    activatedAt: number
    expiresAt: number
    createdAt: number
    _all: number
  }


  export type PushyDeviceAllocationAvgAggregateInputType = {
    id?: true
    deviceId?: true
    tenantId?: true
    subscriptionId?: true
    addOnId?: true
  }

  export type PushyDeviceAllocationSumAggregateInputType = {
    id?: true
    deviceId?: true
    tenantId?: true
    subscriptionId?: true
    addOnId?: true
  }

  export type PushyDeviceAllocationMinAggregateInputType = {
    id?: true
    deviceId?: true
    tenantId?: true
    subscriptionId?: true
    addOnId?: true
    allocationType?: true
    activatedAt?: true
    expiresAt?: true
    createdAt?: true
  }

  export type PushyDeviceAllocationMaxAggregateInputType = {
    id?: true
    deviceId?: true
    tenantId?: true
    subscriptionId?: true
    addOnId?: true
    allocationType?: true
    activatedAt?: true
    expiresAt?: true
    createdAt?: true
  }

  export type PushyDeviceAllocationCountAggregateInputType = {
    id?: true
    deviceId?: true
    tenantId?: true
    subscriptionId?: true
    addOnId?: true
    allocationType?: true
    activatedAt?: true
    expiresAt?: true
    createdAt?: true
    _all?: true
  }

  export type PushyDeviceAllocationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PushyDeviceAllocation to aggregate.
     */
    where?: PushyDeviceAllocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushyDeviceAllocations to fetch.
     */
    orderBy?: PushyDeviceAllocationOrderByWithRelationInput | PushyDeviceAllocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PushyDeviceAllocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushyDeviceAllocations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushyDeviceAllocations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PushyDeviceAllocations
    **/
    _count?: true | PushyDeviceAllocationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PushyDeviceAllocationAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PushyDeviceAllocationSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PushyDeviceAllocationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PushyDeviceAllocationMaxAggregateInputType
  }

  export type GetPushyDeviceAllocationAggregateType<T extends PushyDeviceAllocationAggregateArgs> = {
        [P in keyof T & keyof AggregatePushyDeviceAllocation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePushyDeviceAllocation[P]>
      : GetScalarType<T[P], AggregatePushyDeviceAllocation[P]>
  }




  export type PushyDeviceAllocationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PushyDeviceAllocationWhereInput
    orderBy?: PushyDeviceAllocationOrderByWithAggregationInput | PushyDeviceAllocationOrderByWithAggregationInput[]
    by: PushyDeviceAllocationScalarFieldEnum[] | PushyDeviceAllocationScalarFieldEnum
    having?: PushyDeviceAllocationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PushyDeviceAllocationCountAggregateInputType | true
    _avg?: PushyDeviceAllocationAvgAggregateInputType
    _sum?: PushyDeviceAllocationSumAggregateInputType
    _min?: PushyDeviceAllocationMinAggregateInputType
    _max?: PushyDeviceAllocationMaxAggregateInputType
  }

  export type PushyDeviceAllocationGroupByOutputType = {
    id: number
    deviceId: number
    tenantId: number
    subscriptionId: number | null
    addOnId: number | null
    allocationType: string
    activatedAt: Date
    expiresAt: Date | null
    createdAt: Date
    _count: PushyDeviceAllocationCountAggregateOutputType | null
    _avg: PushyDeviceAllocationAvgAggregateOutputType | null
    _sum: PushyDeviceAllocationSumAggregateOutputType | null
    _min: PushyDeviceAllocationMinAggregateOutputType | null
    _max: PushyDeviceAllocationMaxAggregateOutputType | null
  }

  type GetPushyDeviceAllocationGroupByPayload<T extends PushyDeviceAllocationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PushyDeviceAllocationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PushyDeviceAllocationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PushyDeviceAllocationGroupByOutputType[P]>
            : GetScalarType<T[P], PushyDeviceAllocationGroupByOutputType[P]>
        }
      >
    >


  export type PushyDeviceAllocationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    deviceId?: boolean
    tenantId?: boolean
    subscriptionId?: boolean
    addOnId?: boolean
    allocationType?: boolean
    activatedAt?: boolean
    expiresAt?: boolean
    createdAt?: boolean
    device?: boolean | PushyDeviceDefaultArgs<ExtArgs>
    tenant?: boolean | TenantDefaultArgs<ExtArgs>
    subscription?: boolean | PushyDeviceAllocation$subscriptionArgs<ExtArgs>
  }, ExtArgs["result"]["pushyDeviceAllocation"]>



  export type PushyDeviceAllocationSelectScalar = {
    id?: boolean
    deviceId?: boolean
    tenantId?: boolean
    subscriptionId?: boolean
    addOnId?: boolean
    allocationType?: boolean
    activatedAt?: boolean
    expiresAt?: boolean
    createdAt?: boolean
  }

  export type PushyDeviceAllocationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "deviceId" | "tenantId" | "subscriptionId" | "addOnId" | "allocationType" | "activatedAt" | "expiresAt" | "createdAt", ExtArgs["result"]["pushyDeviceAllocation"]>
  export type PushyDeviceAllocationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    device?: boolean | PushyDeviceDefaultArgs<ExtArgs>
    tenant?: boolean | TenantDefaultArgs<ExtArgs>
    subscription?: boolean | PushyDeviceAllocation$subscriptionArgs<ExtArgs>
  }

  export type $PushyDeviceAllocationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PushyDeviceAllocation"
    objects: {
      device: Prisma.$PushyDevicePayload<ExtArgs>
      tenant: Prisma.$TenantPayload<ExtArgs>
      subscription: Prisma.$TenantSubscriptionPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      deviceId: number
      tenantId: number
      subscriptionId: number | null
      addOnId: number | null
      allocationType: string
      activatedAt: Date
      expiresAt: Date | null
      createdAt: Date
    }, ExtArgs["result"]["pushyDeviceAllocation"]>
    composites: {}
  }

  type PushyDeviceAllocationGetPayload<S extends boolean | null | undefined | PushyDeviceAllocationDefaultArgs> = $Result.GetResult<Prisma.$PushyDeviceAllocationPayload, S>

  type PushyDeviceAllocationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PushyDeviceAllocationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PushyDeviceAllocationCountAggregateInputType | true
    }

  export interface PushyDeviceAllocationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PushyDeviceAllocation'], meta: { name: 'PushyDeviceAllocation' } }
    /**
     * Find zero or one PushyDeviceAllocation that matches the filter.
     * @param {PushyDeviceAllocationFindUniqueArgs} args - Arguments to find a PushyDeviceAllocation
     * @example
     * // Get one PushyDeviceAllocation
     * const pushyDeviceAllocation = await prisma.pushyDeviceAllocation.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PushyDeviceAllocationFindUniqueArgs>(args: SelectSubset<T, PushyDeviceAllocationFindUniqueArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PushyDeviceAllocation that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PushyDeviceAllocationFindUniqueOrThrowArgs} args - Arguments to find a PushyDeviceAllocation
     * @example
     * // Get one PushyDeviceAllocation
     * const pushyDeviceAllocation = await prisma.pushyDeviceAllocation.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PushyDeviceAllocationFindUniqueOrThrowArgs>(args: SelectSubset<T, PushyDeviceAllocationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PushyDeviceAllocation that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceAllocationFindFirstArgs} args - Arguments to find a PushyDeviceAllocation
     * @example
     * // Get one PushyDeviceAllocation
     * const pushyDeviceAllocation = await prisma.pushyDeviceAllocation.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PushyDeviceAllocationFindFirstArgs>(args?: SelectSubset<T, PushyDeviceAllocationFindFirstArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PushyDeviceAllocation that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceAllocationFindFirstOrThrowArgs} args - Arguments to find a PushyDeviceAllocation
     * @example
     * // Get one PushyDeviceAllocation
     * const pushyDeviceAllocation = await prisma.pushyDeviceAllocation.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PushyDeviceAllocationFindFirstOrThrowArgs>(args?: SelectSubset<T, PushyDeviceAllocationFindFirstOrThrowArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PushyDeviceAllocations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceAllocationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PushyDeviceAllocations
     * const pushyDeviceAllocations = await prisma.pushyDeviceAllocation.findMany()
     * 
     * // Get first 10 PushyDeviceAllocations
     * const pushyDeviceAllocations = await prisma.pushyDeviceAllocation.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pushyDeviceAllocationWithIdOnly = await prisma.pushyDeviceAllocation.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PushyDeviceAllocationFindManyArgs>(args?: SelectSubset<T, PushyDeviceAllocationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PushyDeviceAllocation.
     * @param {PushyDeviceAllocationCreateArgs} args - Arguments to create a PushyDeviceAllocation.
     * @example
     * // Create one PushyDeviceAllocation
     * const PushyDeviceAllocation = await prisma.pushyDeviceAllocation.create({
     *   data: {
     *     // ... data to create a PushyDeviceAllocation
     *   }
     * })
     * 
     */
    create<T extends PushyDeviceAllocationCreateArgs>(args: SelectSubset<T, PushyDeviceAllocationCreateArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PushyDeviceAllocations.
     * @param {PushyDeviceAllocationCreateManyArgs} args - Arguments to create many PushyDeviceAllocations.
     * @example
     * // Create many PushyDeviceAllocations
     * const pushyDeviceAllocation = await prisma.pushyDeviceAllocation.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PushyDeviceAllocationCreateManyArgs>(args?: SelectSubset<T, PushyDeviceAllocationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a PushyDeviceAllocation.
     * @param {PushyDeviceAllocationDeleteArgs} args - Arguments to delete one PushyDeviceAllocation.
     * @example
     * // Delete one PushyDeviceAllocation
     * const PushyDeviceAllocation = await prisma.pushyDeviceAllocation.delete({
     *   where: {
     *     // ... filter to delete one PushyDeviceAllocation
     *   }
     * })
     * 
     */
    delete<T extends PushyDeviceAllocationDeleteArgs>(args: SelectSubset<T, PushyDeviceAllocationDeleteArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PushyDeviceAllocation.
     * @param {PushyDeviceAllocationUpdateArgs} args - Arguments to update one PushyDeviceAllocation.
     * @example
     * // Update one PushyDeviceAllocation
     * const pushyDeviceAllocation = await prisma.pushyDeviceAllocation.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PushyDeviceAllocationUpdateArgs>(args: SelectSubset<T, PushyDeviceAllocationUpdateArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PushyDeviceAllocations.
     * @param {PushyDeviceAllocationDeleteManyArgs} args - Arguments to filter PushyDeviceAllocations to delete.
     * @example
     * // Delete a few PushyDeviceAllocations
     * const { count } = await prisma.pushyDeviceAllocation.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PushyDeviceAllocationDeleteManyArgs>(args?: SelectSubset<T, PushyDeviceAllocationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PushyDeviceAllocations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceAllocationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PushyDeviceAllocations
     * const pushyDeviceAllocation = await prisma.pushyDeviceAllocation.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PushyDeviceAllocationUpdateManyArgs>(args: SelectSubset<T, PushyDeviceAllocationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PushyDeviceAllocation.
     * @param {PushyDeviceAllocationUpsertArgs} args - Arguments to update or create a PushyDeviceAllocation.
     * @example
     * // Update or create a PushyDeviceAllocation
     * const pushyDeviceAllocation = await prisma.pushyDeviceAllocation.upsert({
     *   create: {
     *     // ... data to create a PushyDeviceAllocation
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PushyDeviceAllocation we want to update
     *   }
     * })
     */
    upsert<T extends PushyDeviceAllocationUpsertArgs>(args: SelectSubset<T, PushyDeviceAllocationUpsertArgs<ExtArgs>>): Prisma__PushyDeviceAllocationClient<$Result.GetResult<Prisma.$PushyDeviceAllocationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PushyDeviceAllocations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceAllocationCountArgs} args - Arguments to filter PushyDeviceAllocations to count.
     * @example
     * // Count the number of PushyDeviceAllocations
     * const count = await prisma.pushyDeviceAllocation.count({
     *   where: {
     *     // ... the filter for the PushyDeviceAllocations we want to count
     *   }
     * })
    **/
    count<T extends PushyDeviceAllocationCountArgs>(
      args?: Subset<T, PushyDeviceAllocationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PushyDeviceAllocationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PushyDeviceAllocation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceAllocationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PushyDeviceAllocationAggregateArgs>(args: Subset<T, PushyDeviceAllocationAggregateArgs>): Prisma.PrismaPromise<GetPushyDeviceAllocationAggregateType<T>>

    /**
     * Group by PushyDeviceAllocation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PushyDeviceAllocationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PushyDeviceAllocationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PushyDeviceAllocationGroupByArgs['orderBy'] }
        : { orderBy?: PushyDeviceAllocationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PushyDeviceAllocationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPushyDeviceAllocationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PushyDeviceAllocation model
   */
  readonly fields: PushyDeviceAllocationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PushyDeviceAllocation.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PushyDeviceAllocationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    device<T extends PushyDeviceDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PushyDeviceDefaultArgs<ExtArgs>>): Prisma__PushyDeviceClient<$Result.GetResult<Prisma.$PushyDevicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    tenant<T extends TenantDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TenantDefaultArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    subscription<T extends PushyDeviceAllocation$subscriptionArgs<ExtArgs> = {}>(args?: Subset<T, PushyDeviceAllocation$subscriptionArgs<ExtArgs>>): Prisma__TenantSubscriptionClient<$Result.GetResult<Prisma.$TenantSubscriptionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PushyDeviceAllocation model
   */
  interface PushyDeviceAllocationFieldRefs {
    readonly id: FieldRef<"PushyDeviceAllocation", 'Int'>
    readonly deviceId: FieldRef<"PushyDeviceAllocation", 'Int'>
    readonly tenantId: FieldRef<"PushyDeviceAllocation", 'Int'>
    readonly subscriptionId: FieldRef<"PushyDeviceAllocation", 'Int'>
    readonly addOnId: FieldRef<"PushyDeviceAllocation", 'Int'>
    readonly allocationType: FieldRef<"PushyDeviceAllocation", 'String'>
    readonly activatedAt: FieldRef<"PushyDeviceAllocation", 'DateTime'>
    readonly expiresAt: FieldRef<"PushyDeviceAllocation", 'DateTime'>
    readonly createdAt: FieldRef<"PushyDeviceAllocation", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PushyDeviceAllocation findUnique
   */
  export type PushyDeviceAllocationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * Filter, which PushyDeviceAllocation to fetch.
     */
    where: PushyDeviceAllocationWhereUniqueInput
  }

  /**
   * PushyDeviceAllocation findUniqueOrThrow
   */
  export type PushyDeviceAllocationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * Filter, which PushyDeviceAllocation to fetch.
     */
    where: PushyDeviceAllocationWhereUniqueInput
  }

  /**
   * PushyDeviceAllocation findFirst
   */
  export type PushyDeviceAllocationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * Filter, which PushyDeviceAllocation to fetch.
     */
    where?: PushyDeviceAllocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushyDeviceAllocations to fetch.
     */
    orderBy?: PushyDeviceAllocationOrderByWithRelationInput | PushyDeviceAllocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PushyDeviceAllocations.
     */
    cursor?: PushyDeviceAllocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushyDeviceAllocations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushyDeviceAllocations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PushyDeviceAllocations.
     */
    distinct?: PushyDeviceAllocationScalarFieldEnum | PushyDeviceAllocationScalarFieldEnum[]
  }

  /**
   * PushyDeviceAllocation findFirstOrThrow
   */
  export type PushyDeviceAllocationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * Filter, which PushyDeviceAllocation to fetch.
     */
    where?: PushyDeviceAllocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushyDeviceAllocations to fetch.
     */
    orderBy?: PushyDeviceAllocationOrderByWithRelationInput | PushyDeviceAllocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PushyDeviceAllocations.
     */
    cursor?: PushyDeviceAllocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushyDeviceAllocations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushyDeviceAllocations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PushyDeviceAllocations.
     */
    distinct?: PushyDeviceAllocationScalarFieldEnum | PushyDeviceAllocationScalarFieldEnum[]
  }

  /**
   * PushyDeviceAllocation findMany
   */
  export type PushyDeviceAllocationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * Filter, which PushyDeviceAllocations to fetch.
     */
    where?: PushyDeviceAllocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PushyDeviceAllocations to fetch.
     */
    orderBy?: PushyDeviceAllocationOrderByWithRelationInput | PushyDeviceAllocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PushyDeviceAllocations.
     */
    cursor?: PushyDeviceAllocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PushyDeviceAllocations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PushyDeviceAllocations.
     */
    skip?: number
    distinct?: PushyDeviceAllocationScalarFieldEnum | PushyDeviceAllocationScalarFieldEnum[]
  }

  /**
   * PushyDeviceAllocation create
   */
  export type PushyDeviceAllocationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * The data needed to create a PushyDeviceAllocation.
     */
    data: XOR<PushyDeviceAllocationCreateInput, PushyDeviceAllocationUncheckedCreateInput>
  }

  /**
   * PushyDeviceAllocation createMany
   */
  export type PushyDeviceAllocationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PushyDeviceAllocations.
     */
    data: PushyDeviceAllocationCreateManyInput | PushyDeviceAllocationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PushyDeviceAllocation update
   */
  export type PushyDeviceAllocationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * The data needed to update a PushyDeviceAllocation.
     */
    data: XOR<PushyDeviceAllocationUpdateInput, PushyDeviceAllocationUncheckedUpdateInput>
    /**
     * Choose, which PushyDeviceAllocation to update.
     */
    where: PushyDeviceAllocationWhereUniqueInput
  }

  /**
   * PushyDeviceAllocation updateMany
   */
  export type PushyDeviceAllocationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PushyDeviceAllocations.
     */
    data: XOR<PushyDeviceAllocationUpdateManyMutationInput, PushyDeviceAllocationUncheckedUpdateManyInput>
    /**
     * Filter which PushyDeviceAllocations to update
     */
    where?: PushyDeviceAllocationWhereInput
    /**
     * Limit how many PushyDeviceAllocations to update.
     */
    limit?: number
  }

  /**
   * PushyDeviceAllocation upsert
   */
  export type PushyDeviceAllocationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * The filter to search for the PushyDeviceAllocation to update in case it exists.
     */
    where: PushyDeviceAllocationWhereUniqueInput
    /**
     * In case the PushyDeviceAllocation found by the `where` argument doesn't exist, create a new PushyDeviceAllocation with this data.
     */
    create: XOR<PushyDeviceAllocationCreateInput, PushyDeviceAllocationUncheckedCreateInput>
    /**
     * In case the PushyDeviceAllocation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PushyDeviceAllocationUpdateInput, PushyDeviceAllocationUncheckedUpdateInput>
  }

  /**
   * PushyDeviceAllocation delete
   */
  export type PushyDeviceAllocationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
    /**
     * Filter which PushyDeviceAllocation to delete.
     */
    where: PushyDeviceAllocationWhereUniqueInput
  }

  /**
   * PushyDeviceAllocation deleteMany
   */
  export type PushyDeviceAllocationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PushyDeviceAllocations to delete
     */
    where?: PushyDeviceAllocationWhereInput
    /**
     * Limit how many PushyDeviceAllocations to delete.
     */
    limit?: number
  }

  /**
   * PushyDeviceAllocation.subscription
   */
  export type PushyDeviceAllocation$subscriptionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantSubscription
     */
    select?: TenantSubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantSubscription
     */
    omit?: TenantSubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantSubscriptionInclude<ExtArgs> | null
    where?: TenantSubscriptionWhereInput
  }

  /**
   * PushyDeviceAllocation without action
   */
  export type PushyDeviceAllocationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PushyDeviceAllocation
     */
    select?: PushyDeviceAllocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PushyDeviceAllocation
     */
    omit?: PushyDeviceAllocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PushyDeviceAllocationInclude<ExtArgs> | null
  }


  /**
   * Model TenantWarehouse
   */

  export type AggregateTenantWarehouse = {
    _count: TenantWarehouseCountAggregateOutputType | null
    _avg: TenantWarehouseAvgAggregateOutputType | null
    _sum: TenantWarehouseSumAggregateOutputType | null
    _min: TenantWarehouseMinAggregateOutputType | null
    _max: TenantWarehouseMaxAggregateOutputType | null
  }

  export type TenantWarehouseAvgAggregateOutputType = {
    id: number | null
    tenantId: number | null
  }

  export type TenantWarehouseSumAggregateOutputType = {
    id: number | null
    tenantId: number | null
  }

  export type TenantWarehouseMinAggregateOutputType = {
    id: number | null
    tenantId: number | null
    warehouseName: string | null
    warehouseCode: string | null
    address: string | null
    isActive: boolean | null
    deleted: boolean | null
    deletedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TenantWarehouseMaxAggregateOutputType = {
    id: number | null
    tenantId: number | null
    warehouseName: string | null
    warehouseCode: string | null
    address: string | null
    isActive: boolean | null
    deleted: boolean | null
    deletedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TenantWarehouseCountAggregateOutputType = {
    id: number
    tenantId: number
    warehouseName: number
    warehouseCode: number
    address: number
    isActive: number
    deleted: number
    deletedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TenantWarehouseAvgAggregateInputType = {
    id?: true
    tenantId?: true
  }

  export type TenantWarehouseSumAggregateInputType = {
    id?: true
    tenantId?: true
  }

  export type TenantWarehouseMinAggregateInputType = {
    id?: true
    tenantId?: true
    warehouseName?: true
    warehouseCode?: true
    address?: true
    isActive?: true
    deleted?: true
    deletedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TenantWarehouseMaxAggregateInputType = {
    id?: true
    tenantId?: true
    warehouseName?: true
    warehouseCode?: true
    address?: true
    isActive?: true
    deleted?: true
    deletedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TenantWarehouseCountAggregateInputType = {
    id?: true
    tenantId?: true
    warehouseName?: true
    warehouseCode?: true
    address?: true
    isActive?: true
    deleted?: true
    deletedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TenantWarehouseAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantWarehouse to aggregate.
     */
    where?: TenantWarehouseWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantWarehouses to fetch.
     */
    orderBy?: TenantWarehouseOrderByWithRelationInput | TenantWarehouseOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TenantWarehouseWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantWarehouses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantWarehouses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TenantWarehouses
    **/
    _count?: true | TenantWarehouseCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TenantWarehouseAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TenantWarehouseSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TenantWarehouseMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TenantWarehouseMaxAggregateInputType
  }

  export type GetTenantWarehouseAggregateType<T extends TenantWarehouseAggregateArgs> = {
        [P in keyof T & keyof AggregateTenantWarehouse]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTenantWarehouse[P]>
      : GetScalarType<T[P], AggregateTenantWarehouse[P]>
  }




  export type TenantWarehouseGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TenantWarehouseWhereInput
    orderBy?: TenantWarehouseOrderByWithAggregationInput | TenantWarehouseOrderByWithAggregationInput[]
    by: TenantWarehouseScalarFieldEnum[] | TenantWarehouseScalarFieldEnum
    having?: TenantWarehouseScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TenantWarehouseCountAggregateInputType | true
    _avg?: TenantWarehouseAvgAggregateInputType
    _sum?: TenantWarehouseSumAggregateInputType
    _min?: TenantWarehouseMinAggregateInputType
    _max?: TenantWarehouseMaxAggregateInputType
  }

  export type TenantWarehouseGroupByOutputType = {
    id: number
    tenantId: number
    warehouseName: string
    warehouseCode: string
    address: string | null
    isActive: boolean
    deleted: boolean
    deletedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: TenantWarehouseCountAggregateOutputType | null
    _avg: TenantWarehouseAvgAggregateOutputType | null
    _sum: TenantWarehouseSumAggregateOutputType | null
    _min: TenantWarehouseMinAggregateOutputType | null
    _max: TenantWarehouseMaxAggregateOutputType | null
  }

  type GetTenantWarehouseGroupByPayload<T extends TenantWarehouseGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TenantWarehouseGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TenantWarehouseGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TenantWarehouseGroupByOutputType[P]>
            : GetScalarType<T[P], TenantWarehouseGroupByOutputType[P]>
        }
      >
    >


  export type TenantWarehouseSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    warehouseName?: boolean
    warehouseCode?: boolean
    address?: boolean
    isActive?: boolean
    deleted?: boolean
    deletedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    tenant?: boolean | TenantDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tenantWarehouse"]>



  export type TenantWarehouseSelectScalar = {
    id?: boolean
    tenantId?: boolean
    warehouseName?: boolean
    warehouseCode?: boolean
    address?: boolean
    isActive?: boolean
    deleted?: boolean
    deletedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TenantWarehouseOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "tenantId" | "warehouseName" | "warehouseCode" | "address" | "isActive" | "deleted" | "deletedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["tenantWarehouse"]>
  export type TenantWarehouseInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    tenant?: boolean | TenantDefaultArgs<ExtArgs>
  }

  export type $TenantWarehousePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TenantWarehouse"
    objects: {
      tenant: Prisma.$TenantPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      tenantId: number
      warehouseName: string
      warehouseCode: string
      address: string | null
      isActive: boolean
      deleted: boolean
      deletedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["tenantWarehouse"]>
    composites: {}
  }

  type TenantWarehouseGetPayload<S extends boolean | null | undefined | TenantWarehouseDefaultArgs> = $Result.GetResult<Prisma.$TenantWarehousePayload, S>

  type TenantWarehouseCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TenantWarehouseFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TenantWarehouseCountAggregateInputType | true
    }

  export interface TenantWarehouseDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TenantWarehouse'], meta: { name: 'TenantWarehouse' } }
    /**
     * Find zero or one TenantWarehouse that matches the filter.
     * @param {TenantWarehouseFindUniqueArgs} args - Arguments to find a TenantWarehouse
     * @example
     * // Get one TenantWarehouse
     * const tenantWarehouse = await prisma.tenantWarehouse.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TenantWarehouseFindUniqueArgs>(args: SelectSubset<T, TenantWarehouseFindUniqueArgs<ExtArgs>>): Prisma__TenantWarehouseClient<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TenantWarehouse that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TenantWarehouseFindUniqueOrThrowArgs} args - Arguments to find a TenantWarehouse
     * @example
     * // Get one TenantWarehouse
     * const tenantWarehouse = await prisma.tenantWarehouse.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TenantWarehouseFindUniqueOrThrowArgs>(args: SelectSubset<T, TenantWarehouseFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TenantWarehouseClient<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantWarehouse that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantWarehouseFindFirstArgs} args - Arguments to find a TenantWarehouse
     * @example
     * // Get one TenantWarehouse
     * const tenantWarehouse = await prisma.tenantWarehouse.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TenantWarehouseFindFirstArgs>(args?: SelectSubset<T, TenantWarehouseFindFirstArgs<ExtArgs>>): Prisma__TenantWarehouseClient<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TenantWarehouse that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantWarehouseFindFirstOrThrowArgs} args - Arguments to find a TenantWarehouse
     * @example
     * // Get one TenantWarehouse
     * const tenantWarehouse = await prisma.tenantWarehouse.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TenantWarehouseFindFirstOrThrowArgs>(args?: SelectSubset<T, TenantWarehouseFindFirstOrThrowArgs<ExtArgs>>): Prisma__TenantWarehouseClient<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TenantWarehouses that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantWarehouseFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TenantWarehouses
     * const tenantWarehouses = await prisma.tenantWarehouse.findMany()
     * 
     * // Get first 10 TenantWarehouses
     * const tenantWarehouses = await prisma.tenantWarehouse.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tenantWarehouseWithIdOnly = await prisma.tenantWarehouse.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TenantWarehouseFindManyArgs>(args?: SelectSubset<T, TenantWarehouseFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TenantWarehouse.
     * @param {TenantWarehouseCreateArgs} args - Arguments to create a TenantWarehouse.
     * @example
     * // Create one TenantWarehouse
     * const TenantWarehouse = await prisma.tenantWarehouse.create({
     *   data: {
     *     // ... data to create a TenantWarehouse
     *   }
     * })
     * 
     */
    create<T extends TenantWarehouseCreateArgs>(args: SelectSubset<T, TenantWarehouseCreateArgs<ExtArgs>>): Prisma__TenantWarehouseClient<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TenantWarehouses.
     * @param {TenantWarehouseCreateManyArgs} args - Arguments to create many TenantWarehouses.
     * @example
     * // Create many TenantWarehouses
     * const tenantWarehouse = await prisma.tenantWarehouse.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TenantWarehouseCreateManyArgs>(args?: SelectSubset<T, TenantWarehouseCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a TenantWarehouse.
     * @param {TenantWarehouseDeleteArgs} args - Arguments to delete one TenantWarehouse.
     * @example
     * // Delete one TenantWarehouse
     * const TenantWarehouse = await prisma.tenantWarehouse.delete({
     *   where: {
     *     // ... filter to delete one TenantWarehouse
     *   }
     * })
     * 
     */
    delete<T extends TenantWarehouseDeleteArgs>(args: SelectSubset<T, TenantWarehouseDeleteArgs<ExtArgs>>): Prisma__TenantWarehouseClient<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TenantWarehouse.
     * @param {TenantWarehouseUpdateArgs} args - Arguments to update one TenantWarehouse.
     * @example
     * // Update one TenantWarehouse
     * const tenantWarehouse = await prisma.tenantWarehouse.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TenantWarehouseUpdateArgs>(args: SelectSubset<T, TenantWarehouseUpdateArgs<ExtArgs>>): Prisma__TenantWarehouseClient<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TenantWarehouses.
     * @param {TenantWarehouseDeleteManyArgs} args - Arguments to filter TenantWarehouses to delete.
     * @example
     * // Delete a few TenantWarehouses
     * const { count } = await prisma.tenantWarehouse.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TenantWarehouseDeleteManyArgs>(args?: SelectSubset<T, TenantWarehouseDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TenantWarehouses.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantWarehouseUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TenantWarehouses
     * const tenantWarehouse = await prisma.tenantWarehouse.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TenantWarehouseUpdateManyArgs>(args: SelectSubset<T, TenantWarehouseUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one TenantWarehouse.
     * @param {TenantWarehouseUpsertArgs} args - Arguments to update or create a TenantWarehouse.
     * @example
     * // Update or create a TenantWarehouse
     * const tenantWarehouse = await prisma.tenantWarehouse.upsert({
     *   create: {
     *     // ... data to create a TenantWarehouse
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TenantWarehouse we want to update
     *   }
     * })
     */
    upsert<T extends TenantWarehouseUpsertArgs>(args: SelectSubset<T, TenantWarehouseUpsertArgs<ExtArgs>>): Prisma__TenantWarehouseClient<$Result.GetResult<Prisma.$TenantWarehousePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TenantWarehouses.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantWarehouseCountArgs} args - Arguments to filter TenantWarehouses to count.
     * @example
     * // Count the number of TenantWarehouses
     * const count = await prisma.tenantWarehouse.count({
     *   where: {
     *     // ... the filter for the TenantWarehouses we want to count
     *   }
     * })
    **/
    count<T extends TenantWarehouseCountArgs>(
      args?: Subset<T, TenantWarehouseCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TenantWarehouseCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TenantWarehouse.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantWarehouseAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TenantWarehouseAggregateArgs>(args: Subset<T, TenantWarehouseAggregateArgs>): Prisma.PrismaPromise<GetTenantWarehouseAggregateType<T>>

    /**
     * Group by TenantWarehouse.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantWarehouseGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TenantWarehouseGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TenantWarehouseGroupByArgs['orderBy'] }
        : { orderBy?: TenantWarehouseGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TenantWarehouseGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTenantWarehouseGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TenantWarehouse model
   */
  readonly fields: TenantWarehouseFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TenantWarehouse.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TenantWarehouseClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    tenant<T extends TenantDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TenantDefaultArgs<ExtArgs>>): Prisma__TenantClient<$Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TenantWarehouse model
   */
  interface TenantWarehouseFieldRefs {
    readonly id: FieldRef<"TenantWarehouse", 'Int'>
    readonly tenantId: FieldRef<"TenantWarehouse", 'Int'>
    readonly warehouseName: FieldRef<"TenantWarehouse", 'String'>
    readonly warehouseCode: FieldRef<"TenantWarehouse", 'String'>
    readonly address: FieldRef<"TenantWarehouse", 'String'>
    readonly isActive: FieldRef<"TenantWarehouse", 'Boolean'>
    readonly deleted: FieldRef<"TenantWarehouse", 'Boolean'>
    readonly deletedAt: FieldRef<"TenantWarehouse", 'DateTime'>
    readonly createdAt: FieldRef<"TenantWarehouse", 'DateTime'>
    readonly updatedAt: FieldRef<"TenantWarehouse", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TenantWarehouse findUnique
   */
  export type TenantWarehouseFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * Filter, which TenantWarehouse to fetch.
     */
    where: TenantWarehouseWhereUniqueInput
  }

  /**
   * TenantWarehouse findUniqueOrThrow
   */
  export type TenantWarehouseFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * Filter, which TenantWarehouse to fetch.
     */
    where: TenantWarehouseWhereUniqueInput
  }

  /**
   * TenantWarehouse findFirst
   */
  export type TenantWarehouseFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * Filter, which TenantWarehouse to fetch.
     */
    where?: TenantWarehouseWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantWarehouses to fetch.
     */
    orderBy?: TenantWarehouseOrderByWithRelationInput | TenantWarehouseOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantWarehouses.
     */
    cursor?: TenantWarehouseWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantWarehouses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantWarehouses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantWarehouses.
     */
    distinct?: TenantWarehouseScalarFieldEnum | TenantWarehouseScalarFieldEnum[]
  }

  /**
   * TenantWarehouse findFirstOrThrow
   */
  export type TenantWarehouseFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * Filter, which TenantWarehouse to fetch.
     */
    where?: TenantWarehouseWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantWarehouses to fetch.
     */
    orderBy?: TenantWarehouseOrderByWithRelationInput | TenantWarehouseOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TenantWarehouses.
     */
    cursor?: TenantWarehouseWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantWarehouses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantWarehouses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TenantWarehouses.
     */
    distinct?: TenantWarehouseScalarFieldEnum | TenantWarehouseScalarFieldEnum[]
  }

  /**
   * TenantWarehouse findMany
   */
  export type TenantWarehouseFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * Filter, which TenantWarehouses to fetch.
     */
    where?: TenantWarehouseWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TenantWarehouses to fetch.
     */
    orderBy?: TenantWarehouseOrderByWithRelationInput | TenantWarehouseOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TenantWarehouses.
     */
    cursor?: TenantWarehouseWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TenantWarehouses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TenantWarehouses.
     */
    skip?: number
    distinct?: TenantWarehouseScalarFieldEnum | TenantWarehouseScalarFieldEnum[]
  }

  /**
   * TenantWarehouse create
   */
  export type TenantWarehouseCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * The data needed to create a TenantWarehouse.
     */
    data: XOR<TenantWarehouseCreateInput, TenantWarehouseUncheckedCreateInput>
  }

  /**
   * TenantWarehouse createMany
   */
  export type TenantWarehouseCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TenantWarehouses.
     */
    data: TenantWarehouseCreateManyInput | TenantWarehouseCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TenantWarehouse update
   */
  export type TenantWarehouseUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * The data needed to update a TenantWarehouse.
     */
    data: XOR<TenantWarehouseUpdateInput, TenantWarehouseUncheckedUpdateInput>
    /**
     * Choose, which TenantWarehouse to update.
     */
    where: TenantWarehouseWhereUniqueInput
  }

  /**
   * TenantWarehouse updateMany
   */
  export type TenantWarehouseUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TenantWarehouses.
     */
    data: XOR<TenantWarehouseUpdateManyMutationInput, TenantWarehouseUncheckedUpdateManyInput>
    /**
     * Filter which TenantWarehouses to update
     */
    where?: TenantWarehouseWhereInput
    /**
     * Limit how many TenantWarehouses to update.
     */
    limit?: number
  }

  /**
   * TenantWarehouse upsert
   */
  export type TenantWarehouseUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * The filter to search for the TenantWarehouse to update in case it exists.
     */
    where: TenantWarehouseWhereUniqueInput
    /**
     * In case the TenantWarehouse found by the `where` argument doesn't exist, create a new TenantWarehouse with this data.
     */
    create: XOR<TenantWarehouseCreateInput, TenantWarehouseUncheckedCreateInput>
    /**
     * In case the TenantWarehouse was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TenantWarehouseUpdateInput, TenantWarehouseUncheckedUpdateInput>
  }

  /**
   * TenantWarehouse delete
   */
  export type TenantWarehouseDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
    /**
     * Filter which TenantWarehouse to delete.
     */
    where: TenantWarehouseWhereUniqueInput
  }

  /**
   * TenantWarehouse deleteMany
   */
  export type TenantWarehouseDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TenantWarehouses to delete
     */
    where?: TenantWarehouseWhereInput
    /**
     * Limit how many TenantWarehouses to delete.
     */
    limit?: number
  }

  /**
   * TenantWarehouse without action
   */
  export type TenantWarehouseDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TenantWarehouse
     */
    select?: TenantWarehouseSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TenantWarehouse
     */
    omit?: TenantWarehouseOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantWarehouseInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const SubscriptionPlanScalarFieldEnum: {
    id: 'id',
    planName: 'planName',
    planType: 'planType',
    price: 'price',
    maxTransactions: 'maxTransactions',
    maxProducts: 'maxProducts',
    maxUsers: 'maxUsers',
    maxDevices: 'maxDevices',
    description: 'description'
  };

  export type SubscriptionPlanScalarFieldEnum = (typeof SubscriptionPlanScalarFieldEnum)[keyof typeof SubscriptionPlanScalarFieldEnum]


  export const SubscriptionAddOnScalarFieldEnum: {
    id: 'id',
    name: 'name',
    addOnType: 'addOnType',
    pricePerUnit: 'pricePerUnit',
    maxQuantity: 'maxQuantity',
    scope: 'scope',
    description: 'description'
  };

  export type SubscriptionAddOnScalarFieldEnum = (typeof SubscriptionAddOnScalarFieldEnum)[keyof typeof SubscriptionAddOnScalarFieldEnum]


  export const TenantScalarFieldEnum: {
    id: 'id',
    tenantName: 'tenantName',
    databaseName: 'databaseName',
    phoneNumber: 'phoneNumber',
    createdAt: 'createdAt'
  };

  export type TenantScalarFieldEnum = (typeof TenantScalarFieldEnum)[keyof typeof TenantScalarFieldEnum]


  export const TenantSubscriptionScalarFieldEnum: {
    id: 'id',
    tenantId: 'tenantId',
    outletId: 'outletId',
    subscriptionPlanId: 'subscriptionPlanId',
    status: 'status',
    nextPaymentDate: 'nextPaymentDate',
    subscriptionValidUntil: 'subscriptionValidUntil',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    discountId: 'discountId'
  };

  export type TenantSubscriptionScalarFieldEnum = (typeof TenantSubscriptionScalarFieldEnum)[keyof typeof TenantSubscriptionScalarFieldEnum]


  export const TenantSubscriptionAddOnScalarFieldEnum: {
    id: 'id',
    tenantSubscriptionId: 'tenantSubscriptionId',
    addOnId: 'addOnId',
    quantity: 'quantity'
  };

  export type TenantSubscriptionAddOnScalarFieldEnum = (typeof TenantSubscriptionAddOnScalarFieldEnum)[keyof typeof TenantSubscriptionAddOnScalarFieldEnum]


  export const TenantOutletScalarFieldEnum: {
    id: 'id',
    tenantId: 'tenantId',
    outletName: 'outletName',
    address: 'address',
    createdAt: 'createdAt',
    isActive: 'isActive'
  };

  export type TenantOutletScalarFieldEnum = (typeof TenantOutletScalarFieldEnum)[keyof typeof TenantOutletScalarFieldEnum]


  export const DiscountScalarFieldEnum: {
    id: 'id',
    name: 'name',
    discountType: 'discountType',
    value: 'value',
    startDate: 'startDate',
    endDate: 'endDate',
    maxUses: 'maxUses',
    appliesTo: 'appliesTo',
    createdAt: 'createdAt'
  };

  export type DiscountScalarFieldEnum = (typeof DiscountScalarFieldEnum)[keyof typeof DiscountScalarFieldEnum]


  export const TenantUserScalarFieldEnum: {
    id: 'id',
    username: 'username',
    password: 'password',
    tenantId: 'tenantId',
    role: 'role',
    isDeleted: 'isDeleted'
  };

  export type TenantUserScalarFieldEnum = (typeof TenantUserScalarFieldEnum)[keyof typeof TenantUserScalarFieldEnum]


  export const RefreshTokenScalarFieldEnum: {
    id: 'id',
    tenantUserId: 'tenantUserId',
    token: 'token',
    expired: 'expired',
    created: 'created',
    createdByIP: 'createdByIP',
    revoked: 'revoked',
    deleted: 'deleted'
  };

  export type RefreshTokenScalarFieldEnum = (typeof RefreshTokenScalarFieldEnum)[keyof typeof RefreshTokenScalarFieldEnum]


  export const PermissionScalarFieldEnum: {
    id: 'id',
    name: 'name',
    category: 'category',
    description: 'description',
    allowedRoles: 'allowedRoles',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deleted: 'deleted',
    deletedAt: 'deletedAt',
    version: 'version'
  };

  export type PermissionScalarFieldEnum = (typeof PermissionScalarFieldEnum)[keyof typeof PermissionScalarFieldEnum]


  export const SettingDefinitionScalarFieldEnum: {
    id: 'id',
    key: 'key',
    category: 'category',
    type: 'type',
    defaultValue: 'defaultValue',
    description: 'description',
    scope: 'scope',
    isRequired: 'isRequired',
    validationRules: 'validationRules',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deleted: 'deleted',
    deletedAt: 'deletedAt',
    version: 'version'
  };

  export type SettingDefinitionScalarFieldEnum = (typeof SettingDefinitionScalarFieldEnum)[keyof typeof SettingDefinitionScalarFieldEnum]


  export const PushyDeviceScalarFieldEnum: {
    id: 'id',
    tenantUserId: 'tenantUserId',
    deviceToken: 'deviceToken',
    deviceFingerprint: 'deviceFingerprint',
    platform: 'platform',
    deviceName: 'deviceName',
    appVersion: 'appVersion',
    isActive: 'isActive',
    lastActiveAt: 'lastActiveAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type PushyDeviceScalarFieldEnum = (typeof PushyDeviceScalarFieldEnum)[keyof typeof PushyDeviceScalarFieldEnum]


  export const PushySubscriptionScalarFieldEnum: {
    id: 'id',
    deviceId: 'deviceId',
    topic: 'topic',
    subscribedAt: 'subscribedAt'
  };

  export type PushySubscriptionScalarFieldEnum = (typeof PushySubscriptionScalarFieldEnum)[keyof typeof PushySubscriptionScalarFieldEnum]


  export const PushyDeviceAllocationScalarFieldEnum: {
    id: 'id',
    deviceId: 'deviceId',
    tenantId: 'tenantId',
    subscriptionId: 'subscriptionId',
    addOnId: 'addOnId',
    allocationType: 'allocationType',
    activatedAt: 'activatedAt',
    expiresAt: 'expiresAt',
    createdAt: 'createdAt'
  };

  export type PushyDeviceAllocationScalarFieldEnum = (typeof PushyDeviceAllocationScalarFieldEnum)[keyof typeof PushyDeviceAllocationScalarFieldEnum]


  export const TenantWarehouseScalarFieldEnum: {
    id: 'id',
    tenantId: 'tenantId',
    warehouseName: 'warehouseName',
    warehouseCode: 'warehouseCode',
    address: 'address',
    isActive: 'isActive',
    deleted: 'deleted',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TenantWarehouseScalarFieldEnum = (typeof TenantWarehouseScalarFieldEnum)[keyof typeof TenantWarehouseScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const SubscriptionPlanOrderByRelevanceFieldEnum: {
    planName: 'planName',
    planType: 'planType',
    description: 'description'
  };

  export type SubscriptionPlanOrderByRelevanceFieldEnum = (typeof SubscriptionPlanOrderByRelevanceFieldEnum)[keyof typeof SubscriptionPlanOrderByRelevanceFieldEnum]


  export const SubscriptionAddOnOrderByRelevanceFieldEnum: {
    name: 'name',
    addOnType: 'addOnType',
    scope: 'scope',
    description: 'description'
  };

  export type SubscriptionAddOnOrderByRelevanceFieldEnum = (typeof SubscriptionAddOnOrderByRelevanceFieldEnum)[keyof typeof SubscriptionAddOnOrderByRelevanceFieldEnum]


  export const TenantOrderByRelevanceFieldEnum: {
    tenantName: 'tenantName',
    databaseName: 'databaseName',
    phoneNumber: 'phoneNumber'
  };

  export type TenantOrderByRelevanceFieldEnum = (typeof TenantOrderByRelevanceFieldEnum)[keyof typeof TenantOrderByRelevanceFieldEnum]


  export const TenantSubscriptionOrderByRelevanceFieldEnum: {
    status: 'status'
  };

  export type TenantSubscriptionOrderByRelevanceFieldEnum = (typeof TenantSubscriptionOrderByRelevanceFieldEnum)[keyof typeof TenantSubscriptionOrderByRelevanceFieldEnum]


  export const TenantOutletOrderByRelevanceFieldEnum: {
    outletName: 'outletName',
    address: 'address'
  };

  export type TenantOutletOrderByRelevanceFieldEnum = (typeof TenantOutletOrderByRelevanceFieldEnum)[keyof typeof TenantOutletOrderByRelevanceFieldEnum]


  export const DiscountOrderByRelevanceFieldEnum: {
    name: 'name',
    discountType: 'discountType',
    appliesTo: 'appliesTo'
  };

  export type DiscountOrderByRelevanceFieldEnum = (typeof DiscountOrderByRelevanceFieldEnum)[keyof typeof DiscountOrderByRelevanceFieldEnum]


  export const TenantUserOrderByRelevanceFieldEnum: {
    username: 'username',
    password: 'password',
    role: 'role'
  };

  export type TenantUserOrderByRelevanceFieldEnum = (typeof TenantUserOrderByRelevanceFieldEnum)[keyof typeof TenantUserOrderByRelevanceFieldEnum]


  export const RefreshTokenOrderByRelevanceFieldEnum: {
    token: 'token',
    createdByIP: 'createdByIP'
  };

  export type RefreshTokenOrderByRelevanceFieldEnum = (typeof RefreshTokenOrderByRelevanceFieldEnum)[keyof typeof RefreshTokenOrderByRelevanceFieldEnum]


  export const PermissionOrderByRelevanceFieldEnum: {
    name: 'name',
    category: 'category',
    description: 'description',
    allowedRoles: 'allowedRoles'
  };

  export type PermissionOrderByRelevanceFieldEnum = (typeof PermissionOrderByRelevanceFieldEnum)[keyof typeof PermissionOrderByRelevanceFieldEnum]


  export const SettingDefinitionOrderByRelevanceFieldEnum: {
    key: 'key',
    category: 'category',
    type: 'type',
    defaultValue: 'defaultValue',
    description: 'description',
    scope: 'scope',
    validationRules: 'validationRules'
  };

  export type SettingDefinitionOrderByRelevanceFieldEnum = (typeof SettingDefinitionOrderByRelevanceFieldEnum)[keyof typeof SettingDefinitionOrderByRelevanceFieldEnum]


  export const PushyDeviceOrderByRelevanceFieldEnum: {
    deviceToken: 'deviceToken',
    deviceFingerprint: 'deviceFingerprint',
    platform: 'platform',
    deviceName: 'deviceName',
    appVersion: 'appVersion'
  };

  export type PushyDeviceOrderByRelevanceFieldEnum = (typeof PushyDeviceOrderByRelevanceFieldEnum)[keyof typeof PushyDeviceOrderByRelevanceFieldEnum]


  export const PushySubscriptionOrderByRelevanceFieldEnum: {
    topic: 'topic'
  };

  export type PushySubscriptionOrderByRelevanceFieldEnum = (typeof PushySubscriptionOrderByRelevanceFieldEnum)[keyof typeof PushySubscriptionOrderByRelevanceFieldEnum]


  export const PushyDeviceAllocationOrderByRelevanceFieldEnum: {
    allocationType: 'allocationType'
  };

  export type PushyDeviceAllocationOrderByRelevanceFieldEnum = (typeof PushyDeviceAllocationOrderByRelevanceFieldEnum)[keyof typeof PushyDeviceAllocationOrderByRelevanceFieldEnum]


  export const TenantWarehouseOrderByRelevanceFieldEnum: {
    warehouseName: 'warehouseName',
    warehouseCode: 'warehouseCode',
    address: 'address'
  };

  export type TenantWarehouseOrderByRelevanceFieldEnum = (typeof TenantWarehouseOrderByRelevanceFieldEnum)[keyof typeof TenantWarehouseOrderByRelevanceFieldEnum]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    
  /**
   * Deep Input Types
   */


  export type SubscriptionPlanWhereInput = {
    AND?: SubscriptionPlanWhereInput | SubscriptionPlanWhereInput[]
    OR?: SubscriptionPlanWhereInput[]
    NOT?: SubscriptionPlanWhereInput | SubscriptionPlanWhereInput[]
    id?: IntFilter<"SubscriptionPlan"> | number
    planName?: StringFilter<"SubscriptionPlan"> | string
    planType?: StringFilter<"SubscriptionPlan"> | string
    price?: FloatFilter<"SubscriptionPlan"> | number
    maxTransactions?: IntNullableFilter<"SubscriptionPlan"> | number | null
    maxProducts?: IntNullableFilter<"SubscriptionPlan"> | number | null
    maxUsers?: IntNullableFilter<"SubscriptionPlan"> | number | null
    maxDevices?: IntNullableFilter<"SubscriptionPlan"> | number | null
    description?: StringNullableFilter<"SubscriptionPlan"> | string | null
    subscription?: TenantSubscriptionListRelationFilter
  }

  export type SubscriptionPlanOrderByWithRelationInput = {
    id?: SortOrder
    planName?: SortOrder
    planType?: SortOrder
    price?: SortOrder
    maxTransactions?: SortOrderInput | SortOrder
    maxProducts?: SortOrderInput | SortOrder
    maxUsers?: SortOrderInput | SortOrder
    maxDevices?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    subscription?: TenantSubscriptionOrderByRelationAggregateInput
    _relevance?: SubscriptionPlanOrderByRelevanceInput
  }

  export type SubscriptionPlanWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    planName?: string
    AND?: SubscriptionPlanWhereInput | SubscriptionPlanWhereInput[]
    OR?: SubscriptionPlanWhereInput[]
    NOT?: SubscriptionPlanWhereInput | SubscriptionPlanWhereInput[]
    planType?: StringFilter<"SubscriptionPlan"> | string
    price?: FloatFilter<"SubscriptionPlan"> | number
    maxTransactions?: IntNullableFilter<"SubscriptionPlan"> | number | null
    maxProducts?: IntNullableFilter<"SubscriptionPlan"> | number | null
    maxUsers?: IntNullableFilter<"SubscriptionPlan"> | number | null
    maxDevices?: IntNullableFilter<"SubscriptionPlan"> | number | null
    description?: StringNullableFilter<"SubscriptionPlan"> | string | null
    subscription?: TenantSubscriptionListRelationFilter
  }, "id" | "planName">

  export type SubscriptionPlanOrderByWithAggregationInput = {
    id?: SortOrder
    planName?: SortOrder
    planType?: SortOrder
    price?: SortOrder
    maxTransactions?: SortOrderInput | SortOrder
    maxProducts?: SortOrderInput | SortOrder
    maxUsers?: SortOrderInput | SortOrder
    maxDevices?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    _count?: SubscriptionPlanCountOrderByAggregateInput
    _avg?: SubscriptionPlanAvgOrderByAggregateInput
    _max?: SubscriptionPlanMaxOrderByAggregateInput
    _min?: SubscriptionPlanMinOrderByAggregateInput
    _sum?: SubscriptionPlanSumOrderByAggregateInput
  }

  export type SubscriptionPlanScalarWhereWithAggregatesInput = {
    AND?: SubscriptionPlanScalarWhereWithAggregatesInput | SubscriptionPlanScalarWhereWithAggregatesInput[]
    OR?: SubscriptionPlanScalarWhereWithAggregatesInput[]
    NOT?: SubscriptionPlanScalarWhereWithAggregatesInput | SubscriptionPlanScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"SubscriptionPlan"> | number
    planName?: StringWithAggregatesFilter<"SubscriptionPlan"> | string
    planType?: StringWithAggregatesFilter<"SubscriptionPlan"> | string
    price?: FloatWithAggregatesFilter<"SubscriptionPlan"> | number
    maxTransactions?: IntNullableWithAggregatesFilter<"SubscriptionPlan"> | number | null
    maxProducts?: IntNullableWithAggregatesFilter<"SubscriptionPlan"> | number | null
    maxUsers?: IntNullableWithAggregatesFilter<"SubscriptionPlan"> | number | null
    maxDevices?: IntNullableWithAggregatesFilter<"SubscriptionPlan"> | number | null
    description?: StringNullableWithAggregatesFilter<"SubscriptionPlan"> | string | null
  }

  export type SubscriptionAddOnWhereInput = {
    AND?: SubscriptionAddOnWhereInput | SubscriptionAddOnWhereInput[]
    OR?: SubscriptionAddOnWhereInput[]
    NOT?: SubscriptionAddOnWhereInput | SubscriptionAddOnWhereInput[]
    id?: IntFilter<"SubscriptionAddOn"> | number
    name?: StringFilter<"SubscriptionAddOn"> | string
    addOnType?: StringFilter<"SubscriptionAddOn"> | string
    pricePerUnit?: FloatFilter<"SubscriptionAddOn"> | number
    maxQuantity?: IntNullableFilter<"SubscriptionAddOn"> | number | null
    scope?: StringFilter<"SubscriptionAddOn"> | string
    description?: StringNullableFilter<"SubscriptionAddOn"> | string | null
    subscriptions?: TenantSubscriptionAddOnListRelationFilter
  }

  export type SubscriptionAddOnOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    addOnType?: SortOrder
    pricePerUnit?: SortOrder
    maxQuantity?: SortOrderInput | SortOrder
    scope?: SortOrder
    description?: SortOrderInput | SortOrder
    subscriptions?: TenantSubscriptionAddOnOrderByRelationAggregateInput
    _relevance?: SubscriptionAddOnOrderByRelevanceInput
  }

  export type SubscriptionAddOnWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: SubscriptionAddOnWhereInput | SubscriptionAddOnWhereInput[]
    OR?: SubscriptionAddOnWhereInput[]
    NOT?: SubscriptionAddOnWhereInput | SubscriptionAddOnWhereInput[]
    name?: StringFilter<"SubscriptionAddOn"> | string
    addOnType?: StringFilter<"SubscriptionAddOn"> | string
    pricePerUnit?: FloatFilter<"SubscriptionAddOn"> | number
    maxQuantity?: IntNullableFilter<"SubscriptionAddOn"> | number | null
    scope?: StringFilter<"SubscriptionAddOn"> | string
    description?: StringNullableFilter<"SubscriptionAddOn"> | string | null
    subscriptions?: TenantSubscriptionAddOnListRelationFilter
  }, "id">

  export type SubscriptionAddOnOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    addOnType?: SortOrder
    pricePerUnit?: SortOrder
    maxQuantity?: SortOrderInput | SortOrder
    scope?: SortOrder
    description?: SortOrderInput | SortOrder
    _count?: SubscriptionAddOnCountOrderByAggregateInput
    _avg?: SubscriptionAddOnAvgOrderByAggregateInput
    _max?: SubscriptionAddOnMaxOrderByAggregateInput
    _min?: SubscriptionAddOnMinOrderByAggregateInput
    _sum?: SubscriptionAddOnSumOrderByAggregateInput
  }

  export type SubscriptionAddOnScalarWhereWithAggregatesInput = {
    AND?: SubscriptionAddOnScalarWhereWithAggregatesInput | SubscriptionAddOnScalarWhereWithAggregatesInput[]
    OR?: SubscriptionAddOnScalarWhereWithAggregatesInput[]
    NOT?: SubscriptionAddOnScalarWhereWithAggregatesInput | SubscriptionAddOnScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"SubscriptionAddOn"> | number
    name?: StringWithAggregatesFilter<"SubscriptionAddOn"> | string
    addOnType?: StringWithAggregatesFilter<"SubscriptionAddOn"> | string
    pricePerUnit?: FloatWithAggregatesFilter<"SubscriptionAddOn"> | number
    maxQuantity?: IntNullableWithAggregatesFilter<"SubscriptionAddOn"> | number | null
    scope?: StringWithAggregatesFilter<"SubscriptionAddOn"> | string
    description?: StringNullableWithAggregatesFilter<"SubscriptionAddOn"> | string | null
  }

  export type TenantWhereInput = {
    AND?: TenantWhereInput | TenantWhereInput[]
    OR?: TenantWhereInput[]
    NOT?: TenantWhereInput | TenantWhereInput[]
    id?: IntFilter<"Tenant"> | number
    tenantName?: StringFilter<"Tenant"> | string
    databaseName?: StringNullableFilter<"Tenant"> | string | null
    phoneNumber?: StringNullableFilter<"Tenant"> | string | null
    createdAt?: DateTimeFilter<"Tenant"> | Date | string
    tenantUsers?: TenantUserListRelationFilter
    subscription?: TenantSubscriptionListRelationFilter
    tenantOutlets?: TenantOutletListRelationFilter
    deviceAllocations?: PushyDeviceAllocationListRelationFilter
    warehouses?: TenantWarehouseListRelationFilter
  }

  export type TenantOrderByWithRelationInput = {
    id?: SortOrder
    tenantName?: SortOrder
    databaseName?: SortOrderInput | SortOrder
    phoneNumber?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    tenantUsers?: TenantUserOrderByRelationAggregateInput
    subscription?: TenantSubscriptionOrderByRelationAggregateInput
    tenantOutlets?: TenantOutletOrderByRelationAggregateInput
    deviceAllocations?: PushyDeviceAllocationOrderByRelationAggregateInput
    warehouses?: TenantWarehouseOrderByRelationAggregateInput
    _relevance?: TenantOrderByRelevanceInput
  }

  export type TenantWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    databaseName?: string
    AND?: TenantWhereInput | TenantWhereInput[]
    OR?: TenantWhereInput[]
    NOT?: TenantWhereInput | TenantWhereInput[]
    tenantName?: StringFilter<"Tenant"> | string
    phoneNumber?: StringNullableFilter<"Tenant"> | string | null
    createdAt?: DateTimeFilter<"Tenant"> | Date | string
    tenantUsers?: TenantUserListRelationFilter
    subscription?: TenantSubscriptionListRelationFilter
    tenantOutlets?: TenantOutletListRelationFilter
    deviceAllocations?: PushyDeviceAllocationListRelationFilter
    warehouses?: TenantWarehouseListRelationFilter
  }, "id" | "databaseName">

  export type TenantOrderByWithAggregationInput = {
    id?: SortOrder
    tenantName?: SortOrder
    databaseName?: SortOrderInput | SortOrder
    phoneNumber?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: TenantCountOrderByAggregateInput
    _avg?: TenantAvgOrderByAggregateInput
    _max?: TenantMaxOrderByAggregateInput
    _min?: TenantMinOrderByAggregateInput
    _sum?: TenantSumOrderByAggregateInput
  }

  export type TenantScalarWhereWithAggregatesInput = {
    AND?: TenantScalarWhereWithAggregatesInput | TenantScalarWhereWithAggregatesInput[]
    OR?: TenantScalarWhereWithAggregatesInput[]
    NOT?: TenantScalarWhereWithAggregatesInput | TenantScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Tenant"> | number
    tenantName?: StringWithAggregatesFilter<"Tenant"> | string
    databaseName?: StringNullableWithAggregatesFilter<"Tenant"> | string | null
    phoneNumber?: StringNullableWithAggregatesFilter<"Tenant"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Tenant"> | Date | string
  }

  export type TenantSubscriptionWhereInput = {
    AND?: TenantSubscriptionWhereInput | TenantSubscriptionWhereInput[]
    OR?: TenantSubscriptionWhereInput[]
    NOT?: TenantSubscriptionWhereInput | TenantSubscriptionWhereInput[]
    id?: IntFilter<"TenantSubscription"> | number
    tenantId?: IntFilter<"TenantSubscription"> | number
    outletId?: IntFilter<"TenantSubscription"> | number
    subscriptionPlanId?: IntFilter<"TenantSubscription"> | number
    status?: StringFilter<"TenantSubscription"> | string
    nextPaymentDate?: DateTimeFilter<"TenantSubscription"> | Date | string
    subscriptionValidUntil?: DateTimeFilter<"TenantSubscription"> | Date | string
    createdAt?: DateTimeFilter<"TenantSubscription"> | Date | string
    updatedAt?: DateTimeFilter<"TenantSubscription"> | Date | string
    discountId?: IntNullableFilter<"TenantSubscription"> | number | null
    outlet?: XOR<TenantOutletScalarRelationFilter, TenantOutletWhereInput>
    discount?: XOR<DiscountNullableScalarRelationFilter, DiscountWhereInput> | null
    tenant?: XOR<TenantScalarRelationFilter, TenantWhereInput>
    subscriptionPlan?: XOR<SubscriptionPlanScalarRelationFilter, SubscriptionPlanWhereInput>
    subscriptionAddOn?: TenantSubscriptionAddOnListRelationFilter
    deviceAllocations?: PushyDeviceAllocationListRelationFilter
  }

  export type TenantSubscriptionOrderByWithRelationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletId?: SortOrder
    subscriptionPlanId?: SortOrder
    status?: SortOrder
    nextPaymentDate?: SortOrder
    subscriptionValidUntil?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    discountId?: SortOrderInput | SortOrder
    outlet?: TenantOutletOrderByWithRelationInput
    discount?: DiscountOrderByWithRelationInput
    tenant?: TenantOrderByWithRelationInput
    subscriptionPlan?: SubscriptionPlanOrderByWithRelationInput
    subscriptionAddOn?: TenantSubscriptionAddOnOrderByRelationAggregateInput
    deviceAllocations?: PushyDeviceAllocationOrderByRelationAggregateInput
    _relevance?: TenantSubscriptionOrderByRelevanceInput
  }

  export type TenantSubscriptionWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: TenantSubscriptionWhereInput | TenantSubscriptionWhereInput[]
    OR?: TenantSubscriptionWhereInput[]
    NOT?: TenantSubscriptionWhereInput | TenantSubscriptionWhereInput[]
    tenantId?: IntFilter<"TenantSubscription"> | number
    outletId?: IntFilter<"TenantSubscription"> | number
    subscriptionPlanId?: IntFilter<"TenantSubscription"> | number
    status?: StringFilter<"TenantSubscription"> | string
    nextPaymentDate?: DateTimeFilter<"TenantSubscription"> | Date | string
    subscriptionValidUntil?: DateTimeFilter<"TenantSubscription"> | Date | string
    createdAt?: DateTimeFilter<"TenantSubscription"> | Date | string
    updatedAt?: DateTimeFilter<"TenantSubscription"> | Date | string
    discountId?: IntNullableFilter<"TenantSubscription"> | number | null
    outlet?: XOR<TenantOutletScalarRelationFilter, TenantOutletWhereInput>
    discount?: XOR<DiscountNullableScalarRelationFilter, DiscountWhereInput> | null
    tenant?: XOR<TenantScalarRelationFilter, TenantWhereInput>
    subscriptionPlan?: XOR<SubscriptionPlanScalarRelationFilter, SubscriptionPlanWhereInput>
    subscriptionAddOn?: TenantSubscriptionAddOnListRelationFilter
    deviceAllocations?: PushyDeviceAllocationListRelationFilter
  }, "id">

  export type TenantSubscriptionOrderByWithAggregationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletId?: SortOrder
    subscriptionPlanId?: SortOrder
    status?: SortOrder
    nextPaymentDate?: SortOrder
    subscriptionValidUntil?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    discountId?: SortOrderInput | SortOrder
    _count?: TenantSubscriptionCountOrderByAggregateInput
    _avg?: TenantSubscriptionAvgOrderByAggregateInput
    _max?: TenantSubscriptionMaxOrderByAggregateInput
    _min?: TenantSubscriptionMinOrderByAggregateInput
    _sum?: TenantSubscriptionSumOrderByAggregateInput
  }

  export type TenantSubscriptionScalarWhereWithAggregatesInput = {
    AND?: TenantSubscriptionScalarWhereWithAggregatesInput | TenantSubscriptionScalarWhereWithAggregatesInput[]
    OR?: TenantSubscriptionScalarWhereWithAggregatesInput[]
    NOT?: TenantSubscriptionScalarWhereWithAggregatesInput | TenantSubscriptionScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"TenantSubscription"> | number
    tenantId?: IntWithAggregatesFilter<"TenantSubscription"> | number
    outletId?: IntWithAggregatesFilter<"TenantSubscription"> | number
    subscriptionPlanId?: IntWithAggregatesFilter<"TenantSubscription"> | number
    status?: StringWithAggregatesFilter<"TenantSubscription"> | string
    nextPaymentDate?: DateTimeWithAggregatesFilter<"TenantSubscription"> | Date | string
    subscriptionValidUntil?: DateTimeWithAggregatesFilter<"TenantSubscription"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"TenantSubscription"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TenantSubscription"> | Date | string
    discountId?: IntNullableWithAggregatesFilter<"TenantSubscription"> | number | null
  }

  export type TenantSubscriptionAddOnWhereInput = {
    AND?: TenantSubscriptionAddOnWhereInput | TenantSubscriptionAddOnWhereInput[]
    OR?: TenantSubscriptionAddOnWhereInput[]
    NOT?: TenantSubscriptionAddOnWhereInput | TenantSubscriptionAddOnWhereInput[]
    id?: IntFilter<"TenantSubscriptionAddOn"> | number
    tenantSubscriptionId?: IntFilter<"TenantSubscriptionAddOn"> | number
    addOnId?: IntFilter<"TenantSubscriptionAddOn"> | number
    quantity?: IntFilter<"TenantSubscriptionAddOn"> | number
    tenantSubscription?: XOR<TenantSubscriptionScalarRelationFilter, TenantSubscriptionWhereInput>
    addOn?: XOR<SubscriptionAddOnScalarRelationFilter, SubscriptionAddOnWhereInput>
  }

  export type TenantSubscriptionAddOnOrderByWithRelationInput = {
    id?: SortOrder
    tenantSubscriptionId?: SortOrder
    addOnId?: SortOrder
    quantity?: SortOrder
    tenantSubscription?: TenantSubscriptionOrderByWithRelationInput
    addOn?: SubscriptionAddOnOrderByWithRelationInput
  }

  export type TenantSubscriptionAddOnWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    tenantSubscriptionId_addOnId?: TenantSubscriptionAddOnTenantSubscriptionIdAddOnIdCompoundUniqueInput
    AND?: TenantSubscriptionAddOnWhereInput | TenantSubscriptionAddOnWhereInput[]
    OR?: TenantSubscriptionAddOnWhereInput[]
    NOT?: TenantSubscriptionAddOnWhereInput | TenantSubscriptionAddOnWhereInput[]
    tenantSubscriptionId?: IntFilter<"TenantSubscriptionAddOn"> | number
    addOnId?: IntFilter<"TenantSubscriptionAddOn"> | number
    quantity?: IntFilter<"TenantSubscriptionAddOn"> | number
    tenantSubscription?: XOR<TenantSubscriptionScalarRelationFilter, TenantSubscriptionWhereInput>
    addOn?: XOR<SubscriptionAddOnScalarRelationFilter, SubscriptionAddOnWhereInput>
  }, "id" | "tenantSubscriptionId_addOnId">

  export type TenantSubscriptionAddOnOrderByWithAggregationInput = {
    id?: SortOrder
    tenantSubscriptionId?: SortOrder
    addOnId?: SortOrder
    quantity?: SortOrder
    _count?: TenantSubscriptionAddOnCountOrderByAggregateInput
    _avg?: TenantSubscriptionAddOnAvgOrderByAggregateInput
    _max?: TenantSubscriptionAddOnMaxOrderByAggregateInput
    _min?: TenantSubscriptionAddOnMinOrderByAggregateInput
    _sum?: TenantSubscriptionAddOnSumOrderByAggregateInput
  }

  export type TenantSubscriptionAddOnScalarWhereWithAggregatesInput = {
    AND?: TenantSubscriptionAddOnScalarWhereWithAggregatesInput | TenantSubscriptionAddOnScalarWhereWithAggregatesInput[]
    OR?: TenantSubscriptionAddOnScalarWhereWithAggregatesInput[]
    NOT?: TenantSubscriptionAddOnScalarWhereWithAggregatesInput | TenantSubscriptionAddOnScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"TenantSubscriptionAddOn"> | number
    tenantSubscriptionId?: IntWithAggregatesFilter<"TenantSubscriptionAddOn"> | number
    addOnId?: IntWithAggregatesFilter<"TenantSubscriptionAddOn"> | number
    quantity?: IntWithAggregatesFilter<"TenantSubscriptionAddOn"> | number
  }

  export type TenantOutletWhereInput = {
    AND?: TenantOutletWhereInput | TenantOutletWhereInput[]
    OR?: TenantOutletWhereInput[]
    NOT?: TenantOutletWhereInput | TenantOutletWhereInput[]
    id?: IntFilter<"TenantOutlet"> | number
    tenantId?: IntFilter<"TenantOutlet"> | number
    outletName?: StringFilter<"TenantOutlet"> | string
    address?: StringNullableFilter<"TenantOutlet"> | string | null
    createdAt?: DateTimeFilter<"TenantOutlet"> | Date | string
    isActive?: BoolFilter<"TenantOutlet"> | boolean
    tenant?: XOR<TenantScalarRelationFilter, TenantWhereInput>
    subscriptions?: TenantSubscriptionListRelationFilter
  }

  export type TenantOutletOrderByWithRelationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletName?: SortOrder
    address?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    isActive?: SortOrder
    tenant?: TenantOrderByWithRelationInput
    subscriptions?: TenantSubscriptionOrderByRelationAggregateInput
    _relevance?: TenantOutletOrderByRelevanceInput
  }

  export type TenantOutletWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: TenantOutletWhereInput | TenantOutletWhereInput[]
    OR?: TenantOutletWhereInput[]
    NOT?: TenantOutletWhereInput | TenantOutletWhereInput[]
    tenantId?: IntFilter<"TenantOutlet"> | number
    outletName?: StringFilter<"TenantOutlet"> | string
    address?: StringNullableFilter<"TenantOutlet"> | string | null
    createdAt?: DateTimeFilter<"TenantOutlet"> | Date | string
    isActive?: BoolFilter<"TenantOutlet"> | boolean
    tenant?: XOR<TenantScalarRelationFilter, TenantWhereInput>
    subscriptions?: TenantSubscriptionListRelationFilter
  }, "id">

  export type TenantOutletOrderByWithAggregationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletName?: SortOrder
    address?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    isActive?: SortOrder
    _count?: TenantOutletCountOrderByAggregateInput
    _avg?: TenantOutletAvgOrderByAggregateInput
    _max?: TenantOutletMaxOrderByAggregateInput
    _min?: TenantOutletMinOrderByAggregateInput
    _sum?: TenantOutletSumOrderByAggregateInput
  }

  export type TenantOutletScalarWhereWithAggregatesInput = {
    AND?: TenantOutletScalarWhereWithAggregatesInput | TenantOutletScalarWhereWithAggregatesInput[]
    OR?: TenantOutletScalarWhereWithAggregatesInput[]
    NOT?: TenantOutletScalarWhereWithAggregatesInput | TenantOutletScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"TenantOutlet"> | number
    tenantId?: IntWithAggregatesFilter<"TenantOutlet"> | number
    outletName?: StringWithAggregatesFilter<"TenantOutlet"> | string
    address?: StringNullableWithAggregatesFilter<"TenantOutlet"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"TenantOutlet"> | Date | string
    isActive?: BoolWithAggregatesFilter<"TenantOutlet"> | boolean
  }

  export type DiscountWhereInput = {
    AND?: DiscountWhereInput | DiscountWhereInput[]
    OR?: DiscountWhereInput[]
    NOT?: DiscountWhereInput | DiscountWhereInput[]
    id?: IntFilter<"Discount"> | number
    name?: StringFilter<"Discount"> | string
    discountType?: StringFilter<"Discount"> | string
    value?: FloatFilter<"Discount"> | number
    startDate?: DateTimeFilter<"Discount"> | Date | string
    endDate?: DateTimeNullableFilter<"Discount"> | Date | string | null
    maxUses?: IntNullableFilter<"Discount"> | number | null
    appliesTo?: StringFilter<"Discount"> | string
    createdAt?: DateTimeFilter<"Discount"> | Date | string
    subscriptions?: TenantSubscriptionListRelationFilter
  }

  export type DiscountOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    discountType?: SortOrder
    value?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrderInput | SortOrder
    maxUses?: SortOrderInput | SortOrder
    appliesTo?: SortOrder
    createdAt?: SortOrder
    subscriptions?: TenantSubscriptionOrderByRelationAggregateInput
    _relevance?: DiscountOrderByRelevanceInput
  }

  export type DiscountWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: DiscountWhereInput | DiscountWhereInput[]
    OR?: DiscountWhereInput[]
    NOT?: DiscountWhereInput | DiscountWhereInput[]
    name?: StringFilter<"Discount"> | string
    discountType?: StringFilter<"Discount"> | string
    value?: FloatFilter<"Discount"> | number
    startDate?: DateTimeFilter<"Discount"> | Date | string
    endDate?: DateTimeNullableFilter<"Discount"> | Date | string | null
    maxUses?: IntNullableFilter<"Discount"> | number | null
    appliesTo?: StringFilter<"Discount"> | string
    createdAt?: DateTimeFilter<"Discount"> | Date | string
    subscriptions?: TenantSubscriptionListRelationFilter
  }, "id">

  export type DiscountOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    discountType?: SortOrder
    value?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrderInput | SortOrder
    maxUses?: SortOrderInput | SortOrder
    appliesTo?: SortOrder
    createdAt?: SortOrder
    _count?: DiscountCountOrderByAggregateInput
    _avg?: DiscountAvgOrderByAggregateInput
    _max?: DiscountMaxOrderByAggregateInput
    _min?: DiscountMinOrderByAggregateInput
    _sum?: DiscountSumOrderByAggregateInput
  }

  export type DiscountScalarWhereWithAggregatesInput = {
    AND?: DiscountScalarWhereWithAggregatesInput | DiscountScalarWhereWithAggregatesInput[]
    OR?: DiscountScalarWhereWithAggregatesInput[]
    NOT?: DiscountScalarWhereWithAggregatesInput | DiscountScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Discount"> | number
    name?: StringWithAggregatesFilter<"Discount"> | string
    discountType?: StringWithAggregatesFilter<"Discount"> | string
    value?: FloatWithAggregatesFilter<"Discount"> | number
    startDate?: DateTimeWithAggregatesFilter<"Discount"> | Date | string
    endDate?: DateTimeNullableWithAggregatesFilter<"Discount"> | Date | string | null
    maxUses?: IntNullableWithAggregatesFilter<"Discount"> | number | null
    appliesTo?: StringWithAggregatesFilter<"Discount"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Discount"> | Date | string
  }

  export type TenantUserWhereInput = {
    AND?: TenantUserWhereInput | TenantUserWhereInput[]
    OR?: TenantUserWhereInput[]
    NOT?: TenantUserWhereInput | TenantUserWhereInput[]
    id?: IntFilter<"TenantUser"> | number
    username?: StringFilter<"TenantUser"> | string
    password?: StringNullableFilter<"TenantUser"> | string | null
    tenantId?: IntFilter<"TenantUser"> | number
    role?: StringFilter<"TenantUser"> | string
    isDeleted?: BoolFilter<"TenantUser"> | boolean
    tenant?: XOR<TenantNullableScalarRelationFilter, TenantWhereInput> | null
    pushyDevices?: PushyDeviceListRelationFilter
  }

  export type TenantUserOrderByWithRelationInput = {
    id?: SortOrder
    username?: SortOrder
    password?: SortOrderInput | SortOrder
    tenantId?: SortOrder
    role?: SortOrder
    isDeleted?: SortOrder
    tenant?: TenantOrderByWithRelationInput
    pushyDevices?: PushyDeviceOrderByRelationAggregateInput
    _relevance?: TenantUserOrderByRelevanceInput
  }

  export type TenantUserWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    username?: string
    AND?: TenantUserWhereInput | TenantUserWhereInput[]
    OR?: TenantUserWhereInput[]
    NOT?: TenantUserWhereInput | TenantUserWhereInput[]
    password?: StringNullableFilter<"TenantUser"> | string | null
    tenantId?: IntFilter<"TenantUser"> | number
    role?: StringFilter<"TenantUser"> | string
    isDeleted?: BoolFilter<"TenantUser"> | boolean
    tenant?: XOR<TenantNullableScalarRelationFilter, TenantWhereInput> | null
    pushyDevices?: PushyDeviceListRelationFilter
  }, "id" | "username">

  export type TenantUserOrderByWithAggregationInput = {
    id?: SortOrder
    username?: SortOrder
    password?: SortOrderInput | SortOrder
    tenantId?: SortOrder
    role?: SortOrder
    isDeleted?: SortOrder
    _count?: TenantUserCountOrderByAggregateInput
    _avg?: TenantUserAvgOrderByAggregateInput
    _max?: TenantUserMaxOrderByAggregateInput
    _min?: TenantUserMinOrderByAggregateInput
    _sum?: TenantUserSumOrderByAggregateInput
  }

  export type TenantUserScalarWhereWithAggregatesInput = {
    AND?: TenantUserScalarWhereWithAggregatesInput | TenantUserScalarWhereWithAggregatesInput[]
    OR?: TenantUserScalarWhereWithAggregatesInput[]
    NOT?: TenantUserScalarWhereWithAggregatesInput | TenantUserScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"TenantUser"> | number
    username?: StringWithAggregatesFilter<"TenantUser"> | string
    password?: StringNullableWithAggregatesFilter<"TenantUser"> | string | null
    tenantId?: IntWithAggregatesFilter<"TenantUser"> | number
    role?: StringWithAggregatesFilter<"TenantUser"> | string
    isDeleted?: BoolWithAggregatesFilter<"TenantUser"> | boolean
  }

  export type RefreshTokenWhereInput = {
    AND?: RefreshTokenWhereInput | RefreshTokenWhereInput[]
    OR?: RefreshTokenWhereInput[]
    NOT?: RefreshTokenWhereInput | RefreshTokenWhereInput[]
    id?: IntFilter<"RefreshToken"> | number
    tenantUserId?: IntFilter<"RefreshToken"> | number
    token?: StringFilter<"RefreshToken"> | string
    expired?: DateTimeNullableFilter<"RefreshToken"> | Date | string | null
    created?: DateTimeFilter<"RefreshToken"> | Date | string
    createdByIP?: StringNullableFilter<"RefreshToken"> | string | null
    revoked?: DateTimeNullableFilter<"RefreshToken"> | Date | string | null
    deleted?: BoolFilter<"RefreshToken"> | boolean
  }

  export type RefreshTokenOrderByWithRelationInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    token?: SortOrder
    expired?: SortOrderInput | SortOrder
    created?: SortOrder
    createdByIP?: SortOrderInput | SortOrder
    revoked?: SortOrderInput | SortOrder
    deleted?: SortOrder
    _relevance?: RefreshTokenOrderByRelevanceInput
  }

  export type RefreshTokenWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: RefreshTokenWhereInput | RefreshTokenWhereInput[]
    OR?: RefreshTokenWhereInput[]
    NOT?: RefreshTokenWhereInput | RefreshTokenWhereInput[]
    tenantUserId?: IntFilter<"RefreshToken"> | number
    token?: StringFilter<"RefreshToken"> | string
    expired?: DateTimeNullableFilter<"RefreshToken"> | Date | string | null
    created?: DateTimeFilter<"RefreshToken"> | Date | string
    createdByIP?: StringNullableFilter<"RefreshToken"> | string | null
    revoked?: DateTimeNullableFilter<"RefreshToken"> | Date | string | null
    deleted?: BoolFilter<"RefreshToken"> | boolean
  }, "id">

  export type RefreshTokenOrderByWithAggregationInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    token?: SortOrder
    expired?: SortOrderInput | SortOrder
    created?: SortOrder
    createdByIP?: SortOrderInput | SortOrder
    revoked?: SortOrderInput | SortOrder
    deleted?: SortOrder
    _count?: RefreshTokenCountOrderByAggregateInput
    _avg?: RefreshTokenAvgOrderByAggregateInput
    _max?: RefreshTokenMaxOrderByAggregateInput
    _min?: RefreshTokenMinOrderByAggregateInput
    _sum?: RefreshTokenSumOrderByAggregateInput
  }

  export type RefreshTokenScalarWhereWithAggregatesInput = {
    AND?: RefreshTokenScalarWhereWithAggregatesInput | RefreshTokenScalarWhereWithAggregatesInput[]
    OR?: RefreshTokenScalarWhereWithAggregatesInput[]
    NOT?: RefreshTokenScalarWhereWithAggregatesInput | RefreshTokenScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"RefreshToken"> | number
    tenantUserId?: IntWithAggregatesFilter<"RefreshToken"> | number
    token?: StringWithAggregatesFilter<"RefreshToken"> | string
    expired?: DateTimeNullableWithAggregatesFilter<"RefreshToken"> | Date | string | null
    created?: DateTimeWithAggregatesFilter<"RefreshToken"> | Date | string
    createdByIP?: StringNullableWithAggregatesFilter<"RefreshToken"> | string | null
    revoked?: DateTimeNullableWithAggregatesFilter<"RefreshToken"> | Date | string | null
    deleted?: BoolWithAggregatesFilter<"RefreshToken"> | boolean
  }

  export type PermissionWhereInput = {
    AND?: PermissionWhereInput | PermissionWhereInput[]
    OR?: PermissionWhereInput[]
    NOT?: PermissionWhereInput | PermissionWhereInput[]
    id?: IntFilter<"Permission"> | number
    name?: StringFilter<"Permission"> | string
    category?: StringFilter<"Permission"> | string
    description?: StringNullableFilter<"Permission"> | string | null
    allowedRoles?: StringNullableFilter<"Permission"> | string | null
    createdAt?: DateTimeNullableFilter<"Permission"> | Date | string | null
    updatedAt?: DateTimeNullableFilter<"Permission"> | Date | string | null
    deleted?: BoolFilter<"Permission"> | boolean
    deletedAt?: DateTimeNullableFilter<"Permission"> | Date | string | null
    version?: IntNullableFilter<"Permission"> | number | null
  }

  export type PermissionOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    category?: SortOrder
    description?: SortOrderInput | SortOrder
    allowedRoles?: SortOrderInput | SortOrder
    createdAt?: SortOrderInput | SortOrder
    updatedAt?: SortOrderInput | SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    version?: SortOrderInput | SortOrder
    _relevance?: PermissionOrderByRelevanceInput
  }

  export type PermissionWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    name?: string
    AND?: PermissionWhereInput | PermissionWhereInput[]
    OR?: PermissionWhereInput[]
    NOT?: PermissionWhereInput | PermissionWhereInput[]
    category?: StringFilter<"Permission"> | string
    description?: StringNullableFilter<"Permission"> | string | null
    allowedRoles?: StringNullableFilter<"Permission"> | string | null
    createdAt?: DateTimeNullableFilter<"Permission"> | Date | string | null
    updatedAt?: DateTimeNullableFilter<"Permission"> | Date | string | null
    deleted?: BoolFilter<"Permission"> | boolean
    deletedAt?: DateTimeNullableFilter<"Permission"> | Date | string | null
    version?: IntNullableFilter<"Permission"> | number | null
  }, "id" | "name">

  export type PermissionOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    category?: SortOrder
    description?: SortOrderInput | SortOrder
    allowedRoles?: SortOrderInput | SortOrder
    createdAt?: SortOrderInput | SortOrder
    updatedAt?: SortOrderInput | SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    version?: SortOrderInput | SortOrder
    _count?: PermissionCountOrderByAggregateInput
    _avg?: PermissionAvgOrderByAggregateInput
    _max?: PermissionMaxOrderByAggregateInput
    _min?: PermissionMinOrderByAggregateInput
    _sum?: PermissionSumOrderByAggregateInput
  }

  export type PermissionScalarWhereWithAggregatesInput = {
    AND?: PermissionScalarWhereWithAggregatesInput | PermissionScalarWhereWithAggregatesInput[]
    OR?: PermissionScalarWhereWithAggregatesInput[]
    NOT?: PermissionScalarWhereWithAggregatesInput | PermissionScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Permission"> | number
    name?: StringWithAggregatesFilter<"Permission"> | string
    category?: StringWithAggregatesFilter<"Permission"> | string
    description?: StringNullableWithAggregatesFilter<"Permission"> | string | null
    allowedRoles?: StringNullableWithAggregatesFilter<"Permission"> | string | null
    createdAt?: DateTimeNullableWithAggregatesFilter<"Permission"> | Date | string | null
    updatedAt?: DateTimeNullableWithAggregatesFilter<"Permission"> | Date | string | null
    deleted?: BoolWithAggregatesFilter<"Permission"> | boolean
    deletedAt?: DateTimeNullableWithAggregatesFilter<"Permission"> | Date | string | null
    version?: IntNullableWithAggregatesFilter<"Permission"> | number | null
  }

  export type SettingDefinitionWhereInput = {
    AND?: SettingDefinitionWhereInput | SettingDefinitionWhereInput[]
    OR?: SettingDefinitionWhereInput[]
    NOT?: SettingDefinitionWhereInput | SettingDefinitionWhereInput[]
    id?: IntFilter<"SettingDefinition"> | number
    key?: StringFilter<"SettingDefinition"> | string
    category?: StringFilter<"SettingDefinition"> | string
    type?: StringFilter<"SettingDefinition"> | string
    defaultValue?: StringNullableFilter<"SettingDefinition"> | string | null
    description?: StringNullableFilter<"SettingDefinition"> | string | null
    scope?: StringFilter<"SettingDefinition"> | string
    isRequired?: BoolFilter<"SettingDefinition"> | boolean
    validationRules?: StringNullableFilter<"SettingDefinition"> | string | null
    createdAt?: DateTimeFilter<"SettingDefinition"> | Date | string
    updatedAt?: DateTimeFilter<"SettingDefinition"> | Date | string
    deleted?: BoolFilter<"SettingDefinition"> | boolean
    deletedAt?: DateTimeNullableFilter<"SettingDefinition"> | Date | string | null
    version?: IntFilter<"SettingDefinition"> | number
  }

  export type SettingDefinitionOrderByWithRelationInput = {
    id?: SortOrder
    key?: SortOrder
    category?: SortOrder
    type?: SortOrder
    defaultValue?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    scope?: SortOrder
    isRequired?: SortOrder
    validationRules?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    version?: SortOrder
    _relevance?: SettingDefinitionOrderByRelevanceInput
  }

  export type SettingDefinitionWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    key?: string
    AND?: SettingDefinitionWhereInput | SettingDefinitionWhereInput[]
    OR?: SettingDefinitionWhereInput[]
    NOT?: SettingDefinitionWhereInput | SettingDefinitionWhereInput[]
    category?: StringFilter<"SettingDefinition"> | string
    type?: StringFilter<"SettingDefinition"> | string
    defaultValue?: StringNullableFilter<"SettingDefinition"> | string | null
    description?: StringNullableFilter<"SettingDefinition"> | string | null
    scope?: StringFilter<"SettingDefinition"> | string
    isRequired?: BoolFilter<"SettingDefinition"> | boolean
    validationRules?: StringNullableFilter<"SettingDefinition"> | string | null
    createdAt?: DateTimeFilter<"SettingDefinition"> | Date | string
    updatedAt?: DateTimeFilter<"SettingDefinition"> | Date | string
    deleted?: BoolFilter<"SettingDefinition"> | boolean
    deletedAt?: DateTimeNullableFilter<"SettingDefinition"> | Date | string | null
    version?: IntFilter<"SettingDefinition"> | number
  }, "id" | "key">

  export type SettingDefinitionOrderByWithAggregationInput = {
    id?: SortOrder
    key?: SortOrder
    category?: SortOrder
    type?: SortOrder
    defaultValue?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    scope?: SortOrder
    isRequired?: SortOrder
    validationRules?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    version?: SortOrder
    _count?: SettingDefinitionCountOrderByAggregateInput
    _avg?: SettingDefinitionAvgOrderByAggregateInput
    _max?: SettingDefinitionMaxOrderByAggregateInput
    _min?: SettingDefinitionMinOrderByAggregateInput
    _sum?: SettingDefinitionSumOrderByAggregateInput
  }

  export type SettingDefinitionScalarWhereWithAggregatesInput = {
    AND?: SettingDefinitionScalarWhereWithAggregatesInput | SettingDefinitionScalarWhereWithAggregatesInput[]
    OR?: SettingDefinitionScalarWhereWithAggregatesInput[]
    NOT?: SettingDefinitionScalarWhereWithAggregatesInput | SettingDefinitionScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"SettingDefinition"> | number
    key?: StringWithAggregatesFilter<"SettingDefinition"> | string
    category?: StringWithAggregatesFilter<"SettingDefinition"> | string
    type?: StringWithAggregatesFilter<"SettingDefinition"> | string
    defaultValue?: StringNullableWithAggregatesFilter<"SettingDefinition"> | string | null
    description?: StringNullableWithAggregatesFilter<"SettingDefinition"> | string | null
    scope?: StringWithAggregatesFilter<"SettingDefinition"> | string
    isRequired?: BoolWithAggregatesFilter<"SettingDefinition"> | boolean
    validationRules?: StringNullableWithAggregatesFilter<"SettingDefinition"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"SettingDefinition"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"SettingDefinition"> | Date | string
    deleted?: BoolWithAggregatesFilter<"SettingDefinition"> | boolean
    deletedAt?: DateTimeNullableWithAggregatesFilter<"SettingDefinition"> | Date | string | null
    version?: IntWithAggregatesFilter<"SettingDefinition"> | number
  }

  export type PushyDeviceWhereInput = {
    AND?: PushyDeviceWhereInput | PushyDeviceWhereInput[]
    OR?: PushyDeviceWhereInput[]
    NOT?: PushyDeviceWhereInput | PushyDeviceWhereInput[]
    id?: IntFilter<"PushyDevice"> | number
    tenantUserId?: IntFilter<"PushyDevice"> | number
    deviceToken?: StringFilter<"PushyDevice"> | string
    deviceFingerprint?: StringNullableFilter<"PushyDevice"> | string | null
    platform?: StringFilter<"PushyDevice"> | string
    deviceName?: StringNullableFilter<"PushyDevice"> | string | null
    appVersion?: StringNullableFilter<"PushyDevice"> | string | null
    isActive?: BoolFilter<"PushyDevice"> | boolean
    lastActiveAt?: DateTimeNullableFilter<"PushyDevice"> | Date | string | null
    createdAt?: DateTimeFilter<"PushyDevice"> | Date | string
    updatedAt?: DateTimeFilter<"PushyDevice"> | Date | string
    tenantUser?: XOR<TenantUserScalarRelationFilter, TenantUserWhereInput>
    subscriptions?: PushySubscriptionListRelationFilter
    allocation?: XOR<PushyDeviceAllocationNullableScalarRelationFilter, PushyDeviceAllocationWhereInput> | null
  }

  export type PushyDeviceOrderByWithRelationInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    deviceToken?: SortOrder
    deviceFingerprint?: SortOrderInput | SortOrder
    platform?: SortOrder
    deviceName?: SortOrderInput | SortOrder
    appVersion?: SortOrderInput | SortOrder
    isActive?: SortOrder
    lastActiveAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    tenantUser?: TenantUserOrderByWithRelationInput
    subscriptions?: PushySubscriptionOrderByRelationAggregateInput
    allocation?: PushyDeviceAllocationOrderByWithRelationInput
    _relevance?: PushyDeviceOrderByRelevanceInput
  }

  export type PushyDeviceWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    deviceToken?: string
    unique_user_device_fingerprint?: PushyDeviceUnique_user_device_fingerprintCompoundUniqueInput
    AND?: PushyDeviceWhereInput | PushyDeviceWhereInput[]
    OR?: PushyDeviceWhereInput[]
    NOT?: PushyDeviceWhereInput | PushyDeviceWhereInput[]
    tenantUserId?: IntFilter<"PushyDevice"> | number
    deviceFingerprint?: StringNullableFilter<"PushyDevice"> | string | null
    platform?: StringFilter<"PushyDevice"> | string
    deviceName?: StringNullableFilter<"PushyDevice"> | string | null
    appVersion?: StringNullableFilter<"PushyDevice"> | string | null
    isActive?: BoolFilter<"PushyDevice"> | boolean
    lastActiveAt?: DateTimeNullableFilter<"PushyDevice"> | Date | string | null
    createdAt?: DateTimeFilter<"PushyDevice"> | Date | string
    updatedAt?: DateTimeFilter<"PushyDevice"> | Date | string
    tenantUser?: XOR<TenantUserScalarRelationFilter, TenantUserWhereInput>
    subscriptions?: PushySubscriptionListRelationFilter
    allocation?: XOR<PushyDeviceAllocationNullableScalarRelationFilter, PushyDeviceAllocationWhereInput> | null
  }, "id" | "deviceToken" | "unique_user_device_fingerprint">

  export type PushyDeviceOrderByWithAggregationInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    deviceToken?: SortOrder
    deviceFingerprint?: SortOrderInput | SortOrder
    platform?: SortOrder
    deviceName?: SortOrderInput | SortOrder
    appVersion?: SortOrderInput | SortOrder
    isActive?: SortOrder
    lastActiveAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PushyDeviceCountOrderByAggregateInput
    _avg?: PushyDeviceAvgOrderByAggregateInput
    _max?: PushyDeviceMaxOrderByAggregateInput
    _min?: PushyDeviceMinOrderByAggregateInput
    _sum?: PushyDeviceSumOrderByAggregateInput
  }

  export type PushyDeviceScalarWhereWithAggregatesInput = {
    AND?: PushyDeviceScalarWhereWithAggregatesInput | PushyDeviceScalarWhereWithAggregatesInput[]
    OR?: PushyDeviceScalarWhereWithAggregatesInput[]
    NOT?: PushyDeviceScalarWhereWithAggregatesInput | PushyDeviceScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PushyDevice"> | number
    tenantUserId?: IntWithAggregatesFilter<"PushyDevice"> | number
    deviceToken?: StringWithAggregatesFilter<"PushyDevice"> | string
    deviceFingerprint?: StringNullableWithAggregatesFilter<"PushyDevice"> | string | null
    platform?: StringWithAggregatesFilter<"PushyDevice"> | string
    deviceName?: StringNullableWithAggregatesFilter<"PushyDevice"> | string | null
    appVersion?: StringNullableWithAggregatesFilter<"PushyDevice"> | string | null
    isActive?: BoolWithAggregatesFilter<"PushyDevice"> | boolean
    lastActiveAt?: DateTimeNullableWithAggregatesFilter<"PushyDevice"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PushyDevice"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PushyDevice"> | Date | string
  }

  export type PushySubscriptionWhereInput = {
    AND?: PushySubscriptionWhereInput | PushySubscriptionWhereInput[]
    OR?: PushySubscriptionWhereInput[]
    NOT?: PushySubscriptionWhereInput | PushySubscriptionWhereInput[]
    id?: IntFilter<"PushySubscription"> | number
    deviceId?: IntFilter<"PushySubscription"> | number
    topic?: StringFilter<"PushySubscription"> | string
    subscribedAt?: DateTimeFilter<"PushySubscription"> | Date | string
    device?: XOR<PushyDeviceScalarRelationFilter, PushyDeviceWhereInput>
  }

  export type PushySubscriptionOrderByWithRelationInput = {
    id?: SortOrder
    deviceId?: SortOrder
    topic?: SortOrder
    subscribedAt?: SortOrder
    device?: PushyDeviceOrderByWithRelationInput
    _relevance?: PushySubscriptionOrderByRelevanceInput
  }

  export type PushySubscriptionWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    deviceId_topic?: PushySubscriptionDeviceIdTopicCompoundUniqueInput
    AND?: PushySubscriptionWhereInput | PushySubscriptionWhereInput[]
    OR?: PushySubscriptionWhereInput[]
    NOT?: PushySubscriptionWhereInput | PushySubscriptionWhereInput[]
    deviceId?: IntFilter<"PushySubscription"> | number
    topic?: StringFilter<"PushySubscription"> | string
    subscribedAt?: DateTimeFilter<"PushySubscription"> | Date | string
    device?: XOR<PushyDeviceScalarRelationFilter, PushyDeviceWhereInput>
  }, "id" | "deviceId_topic">

  export type PushySubscriptionOrderByWithAggregationInput = {
    id?: SortOrder
    deviceId?: SortOrder
    topic?: SortOrder
    subscribedAt?: SortOrder
    _count?: PushySubscriptionCountOrderByAggregateInput
    _avg?: PushySubscriptionAvgOrderByAggregateInput
    _max?: PushySubscriptionMaxOrderByAggregateInput
    _min?: PushySubscriptionMinOrderByAggregateInput
    _sum?: PushySubscriptionSumOrderByAggregateInput
  }

  export type PushySubscriptionScalarWhereWithAggregatesInput = {
    AND?: PushySubscriptionScalarWhereWithAggregatesInput | PushySubscriptionScalarWhereWithAggregatesInput[]
    OR?: PushySubscriptionScalarWhereWithAggregatesInput[]
    NOT?: PushySubscriptionScalarWhereWithAggregatesInput | PushySubscriptionScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PushySubscription"> | number
    deviceId?: IntWithAggregatesFilter<"PushySubscription"> | number
    topic?: StringWithAggregatesFilter<"PushySubscription"> | string
    subscribedAt?: DateTimeWithAggregatesFilter<"PushySubscription"> | Date | string
  }

  export type PushyDeviceAllocationWhereInput = {
    AND?: PushyDeviceAllocationWhereInput | PushyDeviceAllocationWhereInput[]
    OR?: PushyDeviceAllocationWhereInput[]
    NOT?: PushyDeviceAllocationWhereInput | PushyDeviceAllocationWhereInput[]
    id?: IntFilter<"PushyDeviceAllocation"> | number
    deviceId?: IntFilter<"PushyDeviceAllocation"> | number
    tenantId?: IntFilter<"PushyDeviceAllocation"> | number
    subscriptionId?: IntNullableFilter<"PushyDeviceAllocation"> | number | null
    addOnId?: IntNullableFilter<"PushyDeviceAllocation"> | number | null
    allocationType?: StringFilter<"PushyDeviceAllocation"> | string
    activatedAt?: DateTimeFilter<"PushyDeviceAllocation"> | Date | string
    expiresAt?: DateTimeNullableFilter<"PushyDeviceAllocation"> | Date | string | null
    createdAt?: DateTimeFilter<"PushyDeviceAllocation"> | Date | string
    device?: XOR<PushyDeviceScalarRelationFilter, PushyDeviceWhereInput>
    tenant?: XOR<TenantScalarRelationFilter, TenantWhereInput>
    subscription?: XOR<TenantSubscriptionNullableScalarRelationFilter, TenantSubscriptionWhereInput> | null
  }

  export type PushyDeviceAllocationOrderByWithRelationInput = {
    id?: SortOrder
    deviceId?: SortOrder
    tenantId?: SortOrder
    subscriptionId?: SortOrderInput | SortOrder
    addOnId?: SortOrderInput | SortOrder
    allocationType?: SortOrder
    activatedAt?: SortOrder
    expiresAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    device?: PushyDeviceOrderByWithRelationInput
    tenant?: TenantOrderByWithRelationInput
    subscription?: TenantSubscriptionOrderByWithRelationInput
    _relevance?: PushyDeviceAllocationOrderByRelevanceInput
  }

  export type PushyDeviceAllocationWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    deviceId?: number
    AND?: PushyDeviceAllocationWhereInput | PushyDeviceAllocationWhereInput[]
    OR?: PushyDeviceAllocationWhereInput[]
    NOT?: PushyDeviceAllocationWhereInput | PushyDeviceAllocationWhereInput[]
    tenantId?: IntFilter<"PushyDeviceAllocation"> | number
    subscriptionId?: IntNullableFilter<"PushyDeviceAllocation"> | number | null
    addOnId?: IntNullableFilter<"PushyDeviceAllocation"> | number | null
    allocationType?: StringFilter<"PushyDeviceAllocation"> | string
    activatedAt?: DateTimeFilter<"PushyDeviceAllocation"> | Date | string
    expiresAt?: DateTimeNullableFilter<"PushyDeviceAllocation"> | Date | string | null
    createdAt?: DateTimeFilter<"PushyDeviceAllocation"> | Date | string
    device?: XOR<PushyDeviceScalarRelationFilter, PushyDeviceWhereInput>
    tenant?: XOR<TenantScalarRelationFilter, TenantWhereInput>
    subscription?: XOR<TenantSubscriptionNullableScalarRelationFilter, TenantSubscriptionWhereInput> | null
  }, "id" | "deviceId">

  export type PushyDeviceAllocationOrderByWithAggregationInput = {
    id?: SortOrder
    deviceId?: SortOrder
    tenantId?: SortOrder
    subscriptionId?: SortOrderInput | SortOrder
    addOnId?: SortOrderInput | SortOrder
    allocationType?: SortOrder
    activatedAt?: SortOrder
    expiresAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: PushyDeviceAllocationCountOrderByAggregateInput
    _avg?: PushyDeviceAllocationAvgOrderByAggregateInput
    _max?: PushyDeviceAllocationMaxOrderByAggregateInput
    _min?: PushyDeviceAllocationMinOrderByAggregateInput
    _sum?: PushyDeviceAllocationSumOrderByAggregateInput
  }

  export type PushyDeviceAllocationScalarWhereWithAggregatesInput = {
    AND?: PushyDeviceAllocationScalarWhereWithAggregatesInput | PushyDeviceAllocationScalarWhereWithAggregatesInput[]
    OR?: PushyDeviceAllocationScalarWhereWithAggregatesInput[]
    NOT?: PushyDeviceAllocationScalarWhereWithAggregatesInput | PushyDeviceAllocationScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PushyDeviceAllocation"> | number
    deviceId?: IntWithAggregatesFilter<"PushyDeviceAllocation"> | number
    tenantId?: IntWithAggregatesFilter<"PushyDeviceAllocation"> | number
    subscriptionId?: IntNullableWithAggregatesFilter<"PushyDeviceAllocation"> | number | null
    addOnId?: IntNullableWithAggregatesFilter<"PushyDeviceAllocation"> | number | null
    allocationType?: StringWithAggregatesFilter<"PushyDeviceAllocation"> | string
    activatedAt?: DateTimeWithAggregatesFilter<"PushyDeviceAllocation"> | Date | string
    expiresAt?: DateTimeNullableWithAggregatesFilter<"PushyDeviceAllocation"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PushyDeviceAllocation"> | Date | string
  }

  export type TenantWarehouseWhereInput = {
    AND?: TenantWarehouseWhereInput | TenantWarehouseWhereInput[]
    OR?: TenantWarehouseWhereInput[]
    NOT?: TenantWarehouseWhereInput | TenantWarehouseWhereInput[]
    id?: IntFilter<"TenantWarehouse"> | number
    tenantId?: IntFilter<"TenantWarehouse"> | number
    warehouseName?: StringFilter<"TenantWarehouse"> | string
    warehouseCode?: StringFilter<"TenantWarehouse"> | string
    address?: StringNullableFilter<"TenantWarehouse"> | string | null
    isActive?: BoolFilter<"TenantWarehouse"> | boolean
    deleted?: BoolFilter<"TenantWarehouse"> | boolean
    deletedAt?: DateTimeNullableFilter<"TenantWarehouse"> | Date | string | null
    createdAt?: DateTimeFilter<"TenantWarehouse"> | Date | string
    updatedAt?: DateTimeFilter<"TenantWarehouse"> | Date | string
    tenant?: XOR<TenantScalarRelationFilter, TenantWhereInput>
  }

  export type TenantWarehouseOrderByWithRelationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    warehouseName?: SortOrder
    warehouseCode?: SortOrder
    address?: SortOrderInput | SortOrder
    isActive?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    tenant?: TenantOrderByWithRelationInput
    _relevance?: TenantWarehouseOrderByRelevanceInput
  }

  export type TenantWarehouseWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    tenantId_warehouseCode?: TenantWarehouseTenantIdWarehouseCodeCompoundUniqueInput
    AND?: TenantWarehouseWhereInput | TenantWarehouseWhereInput[]
    OR?: TenantWarehouseWhereInput[]
    NOT?: TenantWarehouseWhereInput | TenantWarehouseWhereInput[]
    tenantId?: IntFilter<"TenantWarehouse"> | number
    warehouseName?: StringFilter<"TenantWarehouse"> | string
    warehouseCode?: StringFilter<"TenantWarehouse"> | string
    address?: StringNullableFilter<"TenantWarehouse"> | string | null
    isActive?: BoolFilter<"TenantWarehouse"> | boolean
    deleted?: BoolFilter<"TenantWarehouse"> | boolean
    deletedAt?: DateTimeNullableFilter<"TenantWarehouse"> | Date | string | null
    createdAt?: DateTimeFilter<"TenantWarehouse"> | Date | string
    updatedAt?: DateTimeFilter<"TenantWarehouse"> | Date | string
    tenant?: XOR<TenantScalarRelationFilter, TenantWhereInput>
  }, "id" | "tenantId_warehouseCode">

  export type TenantWarehouseOrderByWithAggregationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    warehouseName?: SortOrder
    warehouseCode?: SortOrder
    address?: SortOrderInput | SortOrder
    isActive?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TenantWarehouseCountOrderByAggregateInput
    _avg?: TenantWarehouseAvgOrderByAggregateInput
    _max?: TenantWarehouseMaxOrderByAggregateInput
    _min?: TenantWarehouseMinOrderByAggregateInput
    _sum?: TenantWarehouseSumOrderByAggregateInput
  }

  export type TenantWarehouseScalarWhereWithAggregatesInput = {
    AND?: TenantWarehouseScalarWhereWithAggregatesInput | TenantWarehouseScalarWhereWithAggregatesInput[]
    OR?: TenantWarehouseScalarWhereWithAggregatesInput[]
    NOT?: TenantWarehouseScalarWhereWithAggregatesInput | TenantWarehouseScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"TenantWarehouse"> | number
    tenantId?: IntWithAggregatesFilter<"TenantWarehouse"> | number
    warehouseName?: StringWithAggregatesFilter<"TenantWarehouse"> | string
    warehouseCode?: StringWithAggregatesFilter<"TenantWarehouse"> | string
    address?: StringNullableWithAggregatesFilter<"TenantWarehouse"> | string | null
    isActive?: BoolWithAggregatesFilter<"TenantWarehouse"> | boolean
    deleted?: BoolWithAggregatesFilter<"TenantWarehouse"> | boolean
    deletedAt?: DateTimeNullableWithAggregatesFilter<"TenantWarehouse"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"TenantWarehouse"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TenantWarehouse"> | Date | string
  }

  export type SubscriptionPlanCreateInput = {
    planName: string
    planType?: string
    price: number
    maxTransactions?: number | null
    maxProducts?: number | null
    maxUsers?: number | null
    maxDevices?: number | null
    description?: string | null
    subscription?: TenantSubscriptionCreateNestedManyWithoutSubscriptionPlanInput
  }

  export type SubscriptionPlanUncheckedCreateInput = {
    id?: number
    planName: string
    planType?: string
    price: number
    maxTransactions?: number | null
    maxProducts?: number | null
    maxUsers?: number | null
    maxDevices?: number | null
    description?: string | null
    subscription?: TenantSubscriptionUncheckedCreateNestedManyWithoutSubscriptionPlanInput
  }

  export type SubscriptionPlanUpdateInput = {
    planName?: StringFieldUpdateOperationsInput | string
    planType?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    maxTransactions?: NullableIntFieldUpdateOperationsInput | number | null
    maxProducts?: NullableIntFieldUpdateOperationsInput | number | null
    maxUsers?: NullableIntFieldUpdateOperationsInput | number | null
    maxDevices?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    subscription?: TenantSubscriptionUpdateManyWithoutSubscriptionPlanNestedInput
  }

  export type SubscriptionPlanUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    planName?: StringFieldUpdateOperationsInput | string
    planType?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    maxTransactions?: NullableIntFieldUpdateOperationsInput | number | null
    maxProducts?: NullableIntFieldUpdateOperationsInput | number | null
    maxUsers?: NullableIntFieldUpdateOperationsInput | number | null
    maxDevices?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    subscription?: TenantSubscriptionUncheckedUpdateManyWithoutSubscriptionPlanNestedInput
  }

  export type SubscriptionPlanCreateManyInput = {
    id?: number
    planName: string
    planType?: string
    price: number
    maxTransactions?: number | null
    maxProducts?: number | null
    maxUsers?: number | null
    maxDevices?: number | null
    description?: string | null
  }

  export type SubscriptionPlanUpdateManyMutationInput = {
    planName?: StringFieldUpdateOperationsInput | string
    planType?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    maxTransactions?: NullableIntFieldUpdateOperationsInput | number | null
    maxProducts?: NullableIntFieldUpdateOperationsInput | number | null
    maxUsers?: NullableIntFieldUpdateOperationsInput | number | null
    maxDevices?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SubscriptionPlanUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    planName?: StringFieldUpdateOperationsInput | string
    planType?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    maxTransactions?: NullableIntFieldUpdateOperationsInput | number | null
    maxProducts?: NullableIntFieldUpdateOperationsInput | number | null
    maxUsers?: NullableIntFieldUpdateOperationsInput | number | null
    maxDevices?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SubscriptionAddOnCreateInput = {
    name: string
    addOnType: string
    pricePerUnit: number
    maxQuantity?: number | null
    scope?: string
    description?: string | null
    subscriptions?: TenantSubscriptionAddOnCreateNestedManyWithoutAddOnInput
  }

  export type SubscriptionAddOnUncheckedCreateInput = {
    id?: number
    name: string
    addOnType: string
    pricePerUnit: number
    maxQuantity?: number | null
    scope?: string
    description?: string | null
    subscriptions?: TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutAddOnInput
  }

  export type SubscriptionAddOnUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    addOnType?: StringFieldUpdateOperationsInput | string
    pricePerUnit?: FloatFieldUpdateOperationsInput | number
    maxQuantity?: NullableIntFieldUpdateOperationsInput | number | null
    scope?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    subscriptions?: TenantSubscriptionAddOnUpdateManyWithoutAddOnNestedInput
  }

  export type SubscriptionAddOnUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    addOnType?: StringFieldUpdateOperationsInput | string
    pricePerUnit?: FloatFieldUpdateOperationsInput | number
    maxQuantity?: NullableIntFieldUpdateOperationsInput | number | null
    scope?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    subscriptions?: TenantSubscriptionAddOnUncheckedUpdateManyWithoutAddOnNestedInput
  }

  export type SubscriptionAddOnCreateManyInput = {
    id?: number
    name: string
    addOnType: string
    pricePerUnit: number
    maxQuantity?: number | null
    scope?: string
    description?: string | null
  }

  export type SubscriptionAddOnUpdateManyMutationInput = {
    name?: StringFieldUpdateOperationsInput | string
    addOnType?: StringFieldUpdateOperationsInput | string
    pricePerUnit?: FloatFieldUpdateOperationsInput | number
    maxQuantity?: NullableIntFieldUpdateOperationsInput | number | null
    scope?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SubscriptionAddOnUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    addOnType?: StringFieldUpdateOperationsInput | string
    pricePerUnit?: FloatFieldUpdateOperationsInput | number
    maxQuantity?: NullableIntFieldUpdateOperationsInput | number | null
    scope?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TenantCreateInput = {
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserCreateNestedManyWithoutTenantInput
    subscription?: TenantSubscriptionCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseCreateNestedManyWithoutTenantInput
  }

  export type TenantUncheckedCreateInput = {
    id?: number
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserUncheckedCreateNestedManyWithoutTenantInput
    subscription?: TenantSubscriptionUncheckedCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletUncheckedCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseUncheckedCreateNestedManyWithoutTenantInput
  }

  export type TenantUpdateInput = {
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUpdateManyWithoutTenantNestedInput
    subscription?: TenantSubscriptionUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUpdateManyWithoutTenantNestedInput
  }

  export type TenantUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUncheckedUpdateManyWithoutTenantNestedInput
    subscription?: TenantSubscriptionUncheckedUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUncheckedUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUncheckedUpdateManyWithoutTenantNestedInput
  }

  export type TenantCreateManyInput = {
    id?: number
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
  }

  export type TenantUpdateManyMutationInput = {
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantSubscriptionCreateInput = {
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    outlet: TenantOutletCreateNestedOneWithoutSubscriptionsInput
    discount?: DiscountCreateNestedOneWithoutSubscriptionsInput
    tenant: TenantCreateNestedOneWithoutSubscriptionInput
    subscriptionPlan: SubscriptionPlanCreateNestedOneWithoutSubscriptionInput
    subscriptionAddOn?: TenantSubscriptionAddOnCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionUncheckedCreateInput = {
    id?: number
    tenantId: number
    outletId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionUpdateInput = {
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    outlet?: TenantOutletUpdateOneRequiredWithoutSubscriptionsNestedInput
    discount?: DiscountUpdateOneWithoutSubscriptionsNestedInput
    tenant?: TenantUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionPlan?: SubscriptionPlanUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionAddOn?: TenantSubscriptionAddOnUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionCreateManyInput = {
    id?: number
    tenantId: number
    outletId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
  }

  export type TenantSubscriptionUpdateManyMutationInput = {
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantSubscriptionUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type TenantSubscriptionAddOnCreateInput = {
    quantity?: number
    tenantSubscription: TenantSubscriptionCreateNestedOneWithoutSubscriptionAddOnInput
    addOn: SubscriptionAddOnCreateNestedOneWithoutSubscriptionsInput
  }

  export type TenantSubscriptionAddOnUncheckedCreateInput = {
    id?: number
    tenantSubscriptionId: number
    addOnId: number
    quantity?: number
  }

  export type TenantSubscriptionAddOnUpdateInput = {
    quantity?: IntFieldUpdateOperationsInput | number
    tenantSubscription?: TenantSubscriptionUpdateOneRequiredWithoutSubscriptionAddOnNestedInput
    addOn?: SubscriptionAddOnUpdateOneRequiredWithoutSubscriptionsNestedInput
  }

  export type TenantSubscriptionAddOnUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantSubscriptionId?: IntFieldUpdateOperationsInput | number
    addOnId?: IntFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type TenantSubscriptionAddOnCreateManyInput = {
    id?: number
    tenantSubscriptionId: number
    addOnId: number
    quantity?: number
  }

  export type TenantSubscriptionAddOnUpdateManyMutationInput = {
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type TenantSubscriptionAddOnUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantSubscriptionId?: IntFieldUpdateOperationsInput | number
    addOnId?: IntFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type TenantOutletCreateInput = {
    outletName: string
    address?: string | null
    createdAt?: Date | string
    isActive?: boolean
    tenant: TenantCreateNestedOneWithoutTenantOutletsInput
    subscriptions?: TenantSubscriptionCreateNestedManyWithoutOutletInput
  }

  export type TenantOutletUncheckedCreateInput = {
    id?: number
    tenantId: number
    outletName: string
    address?: string | null
    createdAt?: Date | string
    isActive?: boolean
    subscriptions?: TenantSubscriptionUncheckedCreateNestedManyWithoutOutletInput
  }

  export type TenantOutletUpdateInput = {
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    tenant?: TenantUpdateOneRequiredWithoutTenantOutletsNestedInput
    subscriptions?: TenantSubscriptionUpdateManyWithoutOutletNestedInput
  }

  export type TenantOutletUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    subscriptions?: TenantSubscriptionUncheckedUpdateManyWithoutOutletNestedInput
  }

  export type TenantOutletCreateManyInput = {
    id?: number
    tenantId: number
    outletName: string
    address?: string | null
    createdAt?: Date | string
    isActive?: boolean
  }

  export type TenantOutletUpdateManyMutationInput = {
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type TenantOutletUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type DiscountCreateInput = {
    name: string
    discountType: string
    value: number
    startDate?: Date | string
    endDate?: Date | string | null
    maxUses?: number | null
    appliesTo: string
    createdAt?: Date | string
    subscriptions?: TenantSubscriptionCreateNestedManyWithoutDiscountInput
  }

  export type DiscountUncheckedCreateInput = {
    id?: number
    name: string
    discountType: string
    value: number
    startDate?: Date | string
    endDate?: Date | string | null
    maxUses?: number | null
    appliesTo: string
    createdAt?: Date | string
    subscriptions?: TenantSubscriptionUncheckedCreateNestedManyWithoutDiscountInput
  }

  export type DiscountUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    discountType?: StringFieldUpdateOperationsInput | string
    value?: FloatFieldUpdateOperationsInput | number
    startDate?: DateTimeFieldUpdateOperationsInput | Date | string
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maxUses?: NullableIntFieldUpdateOperationsInput | number | null
    appliesTo?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: TenantSubscriptionUpdateManyWithoutDiscountNestedInput
  }

  export type DiscountUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    discountType?: StringFieldUpdateOperationsInput | string
    value?: FloatFieldUpdateOperationsInput | number
    startDate?: DateTimeFieldUpdateOperationsInput | Date | string
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maxUses?: NullableIntFieldUpdateOperationsInput | number | null
    appliesTo?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: TenantSubscriptionUncheckedUpdateManyWithoutDiscountNestedInput
  }

  export type DiscountCreateManyInput = {
    id?: number
    name: string
    discountType: string
    value: number
    startDate?: Date | string
    endDate?: Date | string | null
    maxUses?: number | null
    appliesTo: string
    createdAt?: Date | string
  }

  export type DiscountUpdateManyMutationInput = {
    name?: StringFieldUpdateOperationsInput | string
    discountType?: StringFieldUpdateOperationsInput | string
    value?: FloatFieldUpdateOperationsInput | number
    startDate?: DateTimeFieldUpdateOperationsInput | Date | string
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maxUses?: NullableIntFieldUpdateOperationsInput | number | null
    appliesTo?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DiscountUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    discountType?: StringFieldUpdateOperationsInput | string
    value?: FloatFieldUpdateOperationsInput | number
    startDate?: DateTimeFieldUpdateOperationsInput | Date | string
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maxUses?: NullableIntFieldUpdateOperationsInput | number | null
    appliesTo?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantUserCreateInput = {
    username: string
    password?: string | null
    role?: string
    isDeleted?: boolean
    tenant?: TenantCreateNestedOneWithoutTenantUsersInput
    pushyDevices?: PushyDeviceCreateNestedManyWithoutTenantUserInput
  }

  export type TenantUserUncheckedCreateInput = {
    id?: number
    username: string
    password?: string | null
    tenantId: number
    role?: string
    isDeleted?: boolean
    pushyDevices?: PushyDeviceUncheckedCreateNestedManyWithoutTenantUserInput
  }

  export type TenantUserUpdateInput = {
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    tenant?: TenantUpdateOneWithoutTenantUsersNestedInput
    pushyDevices?: PushyDeviceUpdateManyWithoutTenantUserNestedInput
  }

  export type TenantUserUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    tenantId?: IntFieldUpdateOperationsInput | number
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    pushyDevices?: PushyDeviceUncheckedUpdateManyWithoutTenantUserNestedInput
  }

  export type TenantUserCreateManyInput = {
    id?: number
    username: string
    password?: string | null
    tenantId: number
    role?: string
    isDeleted?: boolean
  }

  export type TenantUserUpdateManyMutationInput = {
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type TenantUserUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    tenantId?: IntFieldUpdateOperationsInput | number
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type RefreshTokenCreateInput = {
    tenantUserId: number
    token: string
    expired?: Date | string | null
    created?: Date | string
    createdByIP?: string | null
    revoked?: Date | string | null
    deleted?: boolean
  }

  export type RefreshTokenUncheckedCreateInput = {
    id?: number
    tenantUserId: number
    token: string
    expired?: Date | string | null
    created?: Date | string
    createdByIP?: string | null
    revoked?: Date | string | null
    deleted?: boolean
  }

  export type RefreshTokenUpdateInput = {
    tenantUserId?: IntFieldUpdateOperationsInput | number
    token?: StringFieldUpdateOperationsInput | string
    expired?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created?: DateTimeFieldUpdateOperationsInput | Date | string
    createdByIP?: NullableStringFieldUpdateOperationsInput | string | null
    revoked?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type RefreshTokenUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantUserId?: IntFieldUpdateOperationsInput | number
    token?: StringFieldUpdateOperationsInput | string
    expired?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created?: DateTimeFieldUpdateOperationsInput | Date | string
    createdByIP?: NullableStringFieldUpdateOperationsInput | string | null
    revoked?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type RefreshTokenCreateManyInput = {
    id?: number
    tenantUserId: number
    token: string
    expired?: Date | string | null
    created?: Date | string
    createdByIP?: string | null
    revoked?: Date | string | null
    deleted?: boolean
  }

  export type RefreshTokenUpdateManyMutationInput = {
    tenantUserId?: IntFieldUpdateOperationsInput | number
    token?: StringFieldUpdateOperationsInput | string
    expired?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created?: DateTimeFieldUpdateOperationsInput | Date | string
    createdByIP?: NullableStringFieldUpdateOperationsInput | string | null
    revoked?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type RefreshTokenUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantUserId?: IntFieldUpdateOperationsInput | number
    token?: StringFieldUpdateOperationsInput | string
    expired?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created?: DateTimeFieldUpdateOperationsInput | Date | string
    createdByIP?: NullableStringFieldUpdateOperationsInput | string | null
    revoked?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PermissionCreateInput = {
    name: string
    category?: string
    description?: string | null
    allowedRoles?: string | null
    createdAt?: Date | string | null
    updatedAt?: Date | string | null
    deleted?: boolean
    deletedAt?: Date | string | null
    version?: number | null
  }

  export type PermissionUncheckedCreateInput = {
    id?: number
    name: string
    category?: string
    description?: string | null
    allowedRoles?: string | null
    createdAt?: Date | string | null
    updatedAt?: Date | string | null
    deleted?: boolean
    deletedAt?: Date | string | null
    version?: number | null
  }

  export type PermissionUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    allowedRoles?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updatedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    version?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type PermissionUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    allowedRoles?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updatedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    version?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type PermissionCreateManyInput = {
    id?: number
    name: string
    category?: string
    description?: string | null
    allowedRoles?: string | null
    createdAt?: Date | string | null
    updatedAt?: Date | string | null
    deleted?: boolean
    deletedAt?: Date | string | null
    version?: number | null
  }

  export type PermissionUpdateManyMutationInput = {
    name?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    allowedRoles?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updatedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    version?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type PermissionUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    allowedRoles?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updatedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    version?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type SettingDefinitionCreateInput = {
    key: string
    category: string
    type: string
    defaultValue?: string | null
    description?: string | null
    scope: string
    isRequired?: boolean
    validationRules?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    deleted?: boolean
    deletedAt?: Date | string | null
    version?: number
  }

  export type SettingDefinitionUncheckedCreateInput = {
    id?: number
    key: string
    category: string
    type: string
    defaultValue?: string | null
    description?: string | null
    scope: string
    isRequired?: boolean
    validationRules?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    deleted?: boolean
    deletedAt?: Date | string | null
    version?: number
  }

  export type SettingDefinitionUpdateInput = {
    key?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    defaultValue?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: StringFieldUpdateOperationsInput | string
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    validationRules?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    version?: IntFieldUpdateOperationsInput | number
  }

  export type SettingDefinitionUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    key?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    defaultValue?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: StringFieldUpdateOperationsInput | string
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    validationRules?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    version?: IntFieldUpdateOperationsInput | number
  }

  export type SettingDefinitionCreateManyInput = {
    id?: number
    key: string
    category: string
    type: string
    defaultValue?: string | null
    description?: string | null
    scope: string
    isRequired?: boolean
    validationRules?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    deleted?: boolean
    deletedAt?: Date | string | null
    version?: number
  }

  export type SettingDefinitionUpdateManyMutationInput = {
    key?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    defaultValue?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: StringFieldUpdateOperationsInput | string
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    validationRules?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    version?: IntFieldUpdateOperationsInput | number
  }

  export type SettingDefinitionUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    key?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    defaultValue?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: StringFieldUpdateOperationsInput | string
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    validationRules?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    version?: IntFieldUpdateOperationsInput | number
  }

  export type PushyDeviceCreateInput = {
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    tenantUser: TenantUserCreateNestedOneWithoutPushyDevicesInput
    subscriptions?: PushySubscriptionCreateNestedManyWithoutDeviceInput
    allocation?: PushyDeviceAllocationCreateNestedOneWithoutDeviceInput
  }

  export type PushyDeviceUncheckedCreateInput = {
    id?: number
    tenantUserId: number
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptions?: PushySubscriptionUncheckedCreateNestedManyWithoutDeviceInput
    allocation?: PushyDeviceAllocationUncheckedCreateNestedOneWithoutDeviceInput
  }

  export type PushyDeviceUpdateInput = {
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUser?: TenantUserUpdateOneRequiredWithoutPushyDevicesNestedInput
    subscriptions?: PushySubscriptionUpdateManyWithoutDeviceNestedInput
    allocation?: PushyDeviceAllocationUpdateOneWithoutDeviceNestedInput
  }

  export type PushyDeviceUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantUserId?: IntFieldUpdateOperationsInput | number
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: PushySubscriptionUncheckedUpdateManyWithoutDeviceNestedInput
    allocation?: PushyDeviceAllocationUncheckedUpdateOneWithoutDeviceNestedInput
  }

  export type PushyDeviceCreateManyInput = {
    id?: number
    tenantUserId: number
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PushyDeviceUpdateManyMutationInput = {
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushyDeviceUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantUserId?: IntFieldUpdateOperationsInput | number
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushySubscriptionCreateInput = {
    topic: string
    subscribedAt?: Date | string
    device: PushyDeviceCreateNestedOneWithoutSubscriptionsInput
  }

  export type PushySubscriptionUncheckedCreateInput = {
    id?: number
    deviceId: number
    topic: string
    subscribedAt?: Date | string
  }

  export type PushySubscriptionUpdateInput = {
    topic?: StringFieldUpdateOperationsInput | string
    subscribedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    device?: PushyDeviceUpdateOneRequiredWithoutSubscriptionsNestedInput
  }

  export type PushySubscriptionUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceId?: IntFieldUpdateOperationsInput | number
    topic?: StringFieldUpdateOperationsInput | string
    subscribedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushySubscriptionCreateManyInput = {
    id?: number
    deviceId: number
    topic: string
    subscribedAt?: Date | string
  }

  export type PushySubscriptionUpdateManyMutationInput = {
    topic?: StringFieldUpdateOperationsInput | string
    subscribedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushySubscriptionUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceId?: IntFieldUpdateOperationsInput | number
    topic?: StringFieldUpdateOperationsInput | string
    subscribedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushyDeviceAllocationCreateInput = {
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
    device: PushyDeviceCreateNestedOneWithoutAllocationInput
    tenant: TenantCreateNestedOneWithoutDeviceAllocationsInput
    subscription?: TenantSubscriptionCreateNestedOneWithoutDeviceAllocationsInput
  }

  export type PushyDeviceAllocationUncheckedCreateInput = {
    id?: number
    deviceId: number
    tenantId: number
    subscriptionId?: number | null
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
  }

  export type PushyDeviceAllocationUpdateInput = {
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    device?: PushyDeviceUpdateOneRequiredWithoutAllocationNestedInput
    tenant?: TenantUpdateOneRequiredWithoutDeviceAllocationsNestedInput
    subscription?: TenantSubscriptionUpdateOneWithoutDeviceAllocationsNestedInput
  }

  export type PushyDeviceAllocationUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceId?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    subscriptionId?: NullableIntFieldUpdateOperationsInput | number | null
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushyDeviceAllocationCreateManyInput = {
    id?: number
    deviceId: number
    tenantId: number
    subscriptionId?: number | null
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
  }

  export type PushyDeviceAllocationUpdateManyMutationInput = {
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushyDeviceAllocationUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceId?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    subscriptionId?: NullableIntFieldUpdateOperationsInput | number | null
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantWarehouseCreateInput = {
    warehouseName: string
    warehouseCode: string
    address?: string | null
    isActive?: boolean
    deleted?: boolean
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    tenant: TenantCreateNestedOneWithoutWarehousesInput
  }

  export type TenantWarehouseUncheckedCreateInput = {
    id?: number
    tenantId: number
    warehouseName: string
    warehouseCode: string
    address?: string | null
    isActive?: boolean
    deleted?: boolean
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TenantWarehouseUpdateInput = {
    warehouseName?: StringFieldUpdateOperationsInput | string
    warehouseCode?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenant?: TenantUpdateOneRequiredWithoutWarehousesNestedInput
  }

  export type TenantWarehouseUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    warehouseName?: StringFieldUpdateOperationsInput | string
    warehouseCode?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantWarehouseCreateManyInput = {
    id?: number
    tenantId: number
    warehouseName: string
    warehouseCode: string
    address?: string | null
    isActive?: boolean
    deleted?: boolean
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TenantWarehouseUpdateManyMutationInput = {
    warehouseName?: StringFieldUpdateOperationsInput | string
    warehouseCode?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantWarehouseUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    warehouseName?: StringFieldUpdateOperationsInput | string
    warehouseCode?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    search?: string
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    search?: string
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type TenantSubscriptionListRelationFilter = {
    every?: TenantSubscriptionWhereInput
    some?: TenantSubscriptionWhereInput
    none?: TenantSubscriptionWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type TenantSubscriptionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SubscriptionPlanOrderByRelevanceInput = {
    fields: SubscriptionPlanOrderByRelevanceFieldEnum | SubscriptionPlanOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type SubscriptionPlanCountOrderByAggregateInput = {
    id?: SortOrder
    planName?: SortOrder
    planType?: SortOrder
    price?: SortOrder
    maxTransactions?: SortOrder
    maxProducts?: SortOrder
    maxUsers?: SortOrder
    maxDevices?: SortOrder
    description?: SortOrder
  }

  export type SubscriptionPlanAvgOrderByAggregateInput = {
    id?: SortOrder
    price?: SortOrder
    maxTransactions?: SortOrder
    maxProducts?: SortOrder
    maxUsers?: SortOrder
    maxDevices?: SortOrder
  }

  export type SubscriptionPlanMaxOrderByAggregateInput = {
    id?: SortOrder
    planName?: SortOrder
    planType?: SortOrder
    price?: SortOrder
    maxTransactions?: SortOrder
    maxProducts?: SortOrder
    maxUsers?: SortOrder
    maxDevices?: SortOrder
    description?: SortOrder
  }

  export type SubscriptionPlanMinOrderByAggregateInput = {
    id?: SortOrder
    planName?: SortOrder
    planType?: SortOrder
    price?: SortOrder
    maxTransactions?: SortOrder
    maxProducts?: SortOrder
    maxUsers?: SortOrder
    maxDevices?: SortOrder
    description?: SortOrder
  }

  export type SubscriptionPlanSumOrderByAggregateInput = {
    id?: SortOrder
    price?: SortOrder
    maxTransactions?: SortOrder
    maxProducts?: SortOrder
    maxUsers?: SortOrder
    maxDevices?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    search?: string
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    search?: string
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type TenantSubscriptionAddOnListRelationFilter = {
    every?: TenantSubscriptionAddOnWhereInput
    some?: TenantSubscriptionAddOnWhereInput
    none?: TenantSubscriptionAddOnWhereInput
  }

  export type TenantSubscriptionAddOnOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SubscriptionAddOnOrderByRelevanceInput = {
    fields: SubscriptionAddOnOrderByRelevanceFieldEnum | SubscriptionAddOnOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type SubscriptionAddOnCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    addOnType?: SortOrder
    pricePerUnit?: SortOrder
    maxQuantity?: SortOrder
    scope?: SortOrder
    description?: SortOrder
  }

  export type SubscriptionAddOnAvgOrderByAggregateInput = {
    id?: SortOrder
    pricePerUnit?: SortOrder
    maxQuantity?: SortOrder
  }

  export type SubscriptionAddOnMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    addOnType?: SortOrder
    pricePerUnit?: SortOrder
    maxQuantity?: SortOrder
    scope?: SortOrder
    description?: SortOrder
  }

  export type SubscriptionAddOnMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    addOnType?: SortOrder
    pricePerUnit?: SortOrder
    maxQuantity?: SortOrder
    scope?: SortOrder
    description?: SortOrder
  }

  export type SubscriptionAddOnSumOrderByAggregateInput = {
    id?: SortOrder
    pricePerUnit?: SortOrder
    maxQuantity?: SortOrder
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type TenantUserListRelationFilter = {
    every?: TenantUserWhereInput
    some?: TenantUserWhereInput
    none?: TenantUserWhereInput
  }

  export type TenantOutletListRelationFilter = {
    every?: TenantOutletWhereInput
    some?: TenantOutletWhereInput
    none?: TenantOutletWhereInput
  }

  export type PushyDeviceAllocationListRelationFilter = {
    every?: PushyDeviceAllocationWhereInput
    some?: PushyDeviceAllocationWhereInput
    none?: PushyDeviceAllocationWhereInput
  }

  export type TenantWarehouseListRelationFilter = {
    every?: TenantWarehouseWhereInput
    some?: TenantWarehouseWhereInput
    none?: TenantWarehouseWhereInput
  }

  export type TenantUserOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TenantOutletOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PushyDeviceAllocationOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TenantWarehouseOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TenantOrderByRelevanceInput = {
    fields: TenantOrderByRelevanceFieldEnum | TenantOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type TenantCountOrderByAggregateInput = {
    id?: SortOrder
    tenantName?: SortOrder
    databaseName?: SortOrder
    phoneNumber?: SortOrder
    createdAt?: SortOrder
  }

  export type TenantAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type TenantMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantName?: SortOrder
    databaseName?: SortOrder
    phoneNumber?: SortOrder
    createdAt?: SortOrder
  }

  export type TenantMinOrderByAggregateInput = {
    id?: SortOrder
    tenantName?: SortOrder
    databaseName?: SortOrder
    phoneNumber?: SortOrder
    createdAt?: SortOrder
  }

  export type TenantSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type TenantOutletScalarRelationFilter = {
    is?: TenantOutletWhereInput
    isNot?: TenantOutletWhereInput
  }

  export type DiscountNullableScalarRelationFilter = {
    is?: DiscountWhereInput | null
    isNot?: DiscountWhereInput | null
  }

  export type TenantScalarRelationFilter = {
    is?: TenantWhereInput
    isNot?: TenantWhereInput
  }

  export type SubscriptionPlanScalarRelationFilter = {
    is?: SubscriptionPlanWhereInput
    isNot?: SubscriptionPlanWhereInput
  }

  export type TenantSubscriptionOrderByRelevanceInput = {
    fields: TenantSubscriptionOrderByRelevanceFieldEnum | TenantSubscriptionOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type TenantSubscriptionCountOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletId?: SortOrder
    subscriptionPlanId?: SortOrder
    status?: SortOrder
    nextPaymentDate?: SortOrder
    subscriptionValidUntil?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    discountId?: SortOrder
  }

  export type TenantSubscriptionAvgOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletId?: SortOrder
    subscriptionPlanId?: SortOrder
    discountId?: SortOrder
  }

  export type TenantSubscriptionMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletId?: SortOrder
    subscriptionPlanId?: SortOrder
    status?: SortOrder
    nextPaymentDate?: SortOrder
    subscriptionValidUntil?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    discountId?: SortOrder
  }

  export type TenantSubscriptionMinOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletId?: SortOrder
    subscriptionPlanId?: SortOrder
    status?: SortOrder
    nextPaymentDate?: SortOrder
    subscriptionValidUntil?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    discountId?: SortOrder
  }

  export type TenantSubscriptionSumOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletId?: SortOrder
    subscriptionPlanId?: SortOrder
    discountId?: SortOrder
  }

  export type TenantSubscriptionScalarRelationFilter = {
    is?: TenantSubscriptionWhereInput
    isNot?: TenantSubscriptionWhereInput
  }

  export type SubscriptionAddOnScalarRelationFilter = {
    is?: SubscriptionAddOnWhereInput
    isNot?: SubscriptionAddOnWhereInput
  }

  export type TenantSubscriptionAddOnTenantSubscriptionIdAddOnIdCompoundUniqueInput = {
    tenantSubscriptionId: number
    addOnId: number
  }

  export type TenantSubscriptionAddOnCountOrderByAggregateInput = {
    id?: SortOrder
    tenantSubscriptionId?: SortOrder
    addOnId?: SortOrder
    quantity?: SortOrder
  }

  export type TenantSubscriptionAddOnAvgOrderByAggregateInput = {
    id?: SortOrder
    tenantSubscriptionId?: SortOrder
    addOnId?: SortOrder
    quantity?: SortOrder
  }

  export type TenantSubscriptionAddOnMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantSubscriptionId?: SortOrder
    addOnId?: SortOrder
    quantity?: SortOrder
  }

  export type TenantSubscriptionAddOnMinOrderByAggregateInput = {
    id?: SortOrder
    tenantSubscriptionId?: SortOrder
    addOnId?: SortOrder
    quantity?: SortOrder
  }

  export type TenantSubscriptionAddOnSumOrderByAggregateInput = {
    id?: SortOrder
    tenantSubscriptionId?: SortOrder
    addOnId?: SortOrder
    quantity?: SortOrder
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type TenantOutletOrderByRelevanceInput = {
    fields: TenantOutletOrderByRelevanceFieldEnum | TenantOutletOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type TenantOutletCountOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletName?: SortOrder
    address?: SortOrder
    createdAt?: SortOrder
    isActive?: SortOrder
  }

  export type TenantOutletAvgOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
  }

  export type TenantOutletMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletName?: SortOrder
    address?: SortOrder
    createdAt?: SortOrder
    isActive?: SortOrder
  }

  export type TenantOutletMinOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    outletName?: SortOrder
    address?: SortOrder
    createdAt?: SortOrder
    isActive?: SortOrder
  }

  export type TenantOutletSumOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type DiscountOrderByRelevanceInput = {
    fields: DiscountOrderByRelevanceFieldEnum | DiscountOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type DiscountCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    discountType?: SortOrder
    value?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    maxUses?: SortOrder
    appliesTo?: SortOrder
    createdAt?: SortOrder
  }

  export type DiscountAvgOrderByAggregateInput = {
    id?: SortOrder
    value?: SortOrder
    maxUses?: SortOrder
  }

  export type DiscountMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    discountType?: SortOrder
    value?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    maxUses?: SortOrder
    appliesTo?: SortOrder
    createdAt?: SortOrder
  }

  export type DiscountMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    discountType?: SortOrder
    value?: SortOrder
    startDate?: SortOrder
    endDate?: SortOrder
    maxUses?: SortOrder
    appliesTo?: SortOrder
    createdAt?: SortOrder
  }

  export type DiscountSumOrderByAggregateInput = {
    id?: SortOrder
    value?: SortOrder
    maxUses?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type TenantNullableScalarRelationFilter = {
    is?: TenantWhereInput | null
    isNot?: TenantWhereInput | null
  }

  export type PushyDeviceListRelationFilter = {
    every?: PushyDeviceWhereInput
    some?: PushyDeviceWhereInput
    none?: PushyDeviceWhereInput
  }

  export type PushyDeviceOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TenantUserOrderByRelevanceInput = {
    fields: TenantUserOrderByRelevanceFieldEnum | TenantUserOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type TenantUserCountOrderByAggregateInput = {
    id?: SortOrder
    username?: SortOrder
    password?: SortOrder
    tenantId?: SortOrder
    role?: SortOrder
    isDeleted?: SortOrder
  }

  export type TenantUserAvgOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
  }

  export type TenantUserMaxOrderByAggregateInput = {
    id?: SortOrder
    username?: SortOrder
    password?: SortOrder
    tenantId?: SortOrder
    role?: SortOrder
    isDeleted?: SortOrder
  }

  export type TenantUserMinOrderByAggregateInput = {
    id?: SortOrder
    username?: SortOrder
    password?: SortOrder
    tenantId?: SortOrder
    role?: SortOrder
    isDeleted?: SortOrder
  }

  export type TenantUserSumOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
  }

  export type RefreshTokenOrderByRelevanceInput = {
    fields: RefreshTokenOrderByRelevanceFieldEnum | RefreshTokenOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type RefreshTokenCountOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    token?: SortOrder
    expired?: SortOrder
    created?: SortOrder
    createdByIP?: SortOrder
    revoked?: SortOrder
    deleted?: SortOrder
  }

  export type RefreshTokenAvgOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
  }

  export type RefreshTokenMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    token?: SortOrder
    expired?: SortOrder
    created?: SortOrder
    createdByIP?: SortOrder
    revoked?: SortOrder
    deleted?: SortOrder
  }

  export type RefreshTokenMinOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    token?: SortOrder
    expired?: SortOrder
    created?: SortOrder
    createdByIP?: SortOrder
    revoked?: SortOrder
    deleted?: SortOrder
  }

  export type RefreshTokenSumOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
  }

  export type PermissionOrderByRelevanceInput = {
    fields: PermissionOrderByRelevanceFieldEnum | PermissionOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type PermissionCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    category?: SortOrder
    description?: SortOrder
    allowedRoles?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    version?: SortOrder
  }

  export type PermissionAvgOrderByAggregateInput = {
    id?: SortOrder
    version?: SortOrder
  }

  export type PermissionMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    category?: SortOrder
    description?: SortOrder
    allowedRoles?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    version?: SortOrder
  }

  export type PermissionMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    category?: SortOrder
    description?: SortOrder
    allowedRoles?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    version?: SortOrder
  }

  export type PermissionSumOrderByAggregateInput = {
    id?: SortOrder
    version?: SortOrder
  }

  export type SettingDefinitionOrderByRelevanceInput = {
    fields: SettingDefinitionOrderByRelevanceFieldEnum | SettingDefinitionOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type SettingDefinitionCountOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    category?: SortOrder
    type?: SortOrder
    defaultValue?: SortOrder
    description?: SortOrder
    scope?: SortOrder
    isRequired?: SortOrder
    validationRules?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    version?: SortOrder
  }

  export type SettingDefinitionAvgOrderByAggregateInput = {
    id?: SortOrder
    version?: SortOrder
  }

  export type SettingDefinitionMaxOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    category?: SortOrder
    type?: SortOrder
    defaultValue?: SortOrder
    description?: SortOrder
    scope?: SortOrder
    isRequired?: SortOrder
    validationRules?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    version?: SortOrder
  }

  export type SettingDefinitionMinOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    category?: SortOrder
    type?: SortOrder
    defaultValue?: SortOrder
    description?: SortOrder
    scope?: SortOrder
    isRequired?: SortOrder
    validationRules?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    version?: SortOrder
  }

  export type SettingDefinitionSumOrderByAggregateInput = {
    id?: SortOrder
    version?: SortOrder
  }

  export type TenantUserScalarRelationFilter = {
    is?: TenantUserWhereInput
    isNot?: TenantUserWhereInput
  }

  export type PushySubscriptionListRelationFilter = {
    every?: PushySubscriptionWhereInput
    some?: PushySubscriptionWhereInput
    none?: PushySubscriptionWhereInput
  }

  export type PushyDeviceAllocationNullableScalarRelationFilter = {
    is?: PushyDeviceAllocationWhereInput | null
    isNot?: PushyDeviceAllocationWhereInput | null
  }

  export type PushySubscriptionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PushyDeviceOrderByRelevanceInput = {
    fields: PushyDeviceOrderByRelevanceFieldEnum | PushyDeviceOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type PushyDeviceUnique_user_device_fingerprintCompoundUniqueInput = {
    tenantUserId: number
    deviceFingerprint: string
  }

  export type PushyDeviceCountOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    deviceToken?: SortOrder
    deviceFingerprint?: SortOrder
    platform?: SortOrder
    deviceName?: SortOrder
    appVersion?: SortOrder
    isActive?: SortOrder
    lastActiveAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PushyDeviceAvgOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
  }

  export type PushyDeviceMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    deviceToken?: SortOrder
    deviceFingerprint?: SortOrder
    platform?: SortOrder
    deviceName?: SortOrder
    appVersion?: SortOrder
    isActive?: SortOrder
    lastActiveAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PushyDeviceMinOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
    deviceToken?: SortOrder
    deviceFingerprint?: SortOrder
    platform?: SortOrder
    deviceName?: SortOrder
    appVersion?: SortOrder
    isActive?: SortOrder
    lastActiveAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PushyDeviceSumOrderByAggregateInput = {
    id?: SortOrder
    tenantUserId?: SortOrder
  }

  export type PushyDeviceScalarRelationFilter = {
    is?: PushyDeviceWhereInput
    isNot?: PushyDeviceWhereInput
  }

  export type PushySubscriptionOrderByRelevanceInput = {
    fields: PushySubscriptionOrderByRelevanceFieldEnum | PushySubscriptionOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type PushySubscriptionDeviceIdTopicCompoundUniqueInput = {
    deviceId: number
    topic: string
  }

  export type PushySubscriptionCountOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
    topic?: SortOrder
    subscribedAt?: SortOrder
  }

  export type PushySubscriptionAvgOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
  }

  export type PushySubscriptionMaxOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
    topic?: SortOrder
    subscribedAt?: SortOrder
  }

  export type PushySubscriptionMinOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
    topic?: SortOrder
    subscribedAt?: SortOrder
  }

  export type PushySubscriptionSumOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
  }

  export type TenantSubscriptionNullableScalarRelationFilter = {
    is?: TenantSubscriptionWhereInput | null
    isNot?: TenantSubscriptionWhereInput | null
  }

  export type PushyDeviceAllocationOrderByRelevanceInput = {
    fields: PushyDeviceAllocationOrderByRelevanceFieldEnum | PushyDeviceAllocationOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type PushyDeviceAllocationCountOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
    tenantId?: SortOrder
    subscriptionId?: SortOrder
    addOnId?: SortOrder
    allocationType?: SortOrder
    activatedAt?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
  }

  export type PushyDeviceAllocationAvgOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
    tenantId?: SortOrder
    subscriptionId?: SortOrder
    addOnId?: SortOrder
  }

  export type PushyDeviceAllocationMaxOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
    tenantId?: SortOrder
    subscriptionId?: SortOrder
    addOnId?: SortOrder
    allocationType?: SortOrder
    activatedAt?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
  }

  export type PushyDeviceAllocationMinOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
    tenantId?: SortOrder
    subscriptionId?: SortOrder
    addOnId?: SortOrder
    allocationType?: SortOrder
    activatedAt?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
  }

  export type PushyDeviceAllocationSumOrderByAggregateInput = {
    id?: SortOrder
    deviceId?: SortOrder
    tenantId?: SortOrder
    subscriptionId?: SortOrder
    addOnId?: SortOrder
  }

  export type TenantWarehouseOrderByRelevanceInput = {
    fields: TenantWarehouseOrderByRelevanceFieldEnum | TenantWarehouseOrderByRelevanceFieldEnum[]
    sort: SortOrder
    search: string
  }

  export type TenantWarehouseTenantIdWarehouseCodeCompoundUniqueInput = {
    tenantId: number
    warehouseCode: string
  }

  export type TenantWarehouseCountOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    warehouseName?: SortOrder
    warehouseCode?: SortOrder
    address?: SortOrder
    isActive?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TenantWarehouseAvgOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
  }

  export type TenantWarehouseMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    warehouseName?: SortOrder
    warehouseCode?: SortOrder
    address?: SortOrder
    isActive?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TenantWarehouseMinOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    warehouseName?: SortOrder
    warehouseCode?: SortOrder
    address?: SortOrder
    isActive?: SortOrder
    deleted?: SortOrder
    deletedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TenantWarehouseSumOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
  }

  export type TenantSubscriptionCreateNestedManyWithoutSubscriptionPlanInput = {
    create?: XOR<TenantSubscriptionCreateWithoutSubscriptionPlanInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput> | TenantSubscriptionCreateWithoutSubscriptionPlanInput[] | TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput | TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput[]
    createMany?: TenantSubscriptionCreateManySubscriptionPlanInputEnvelope
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
  }

  export type TenantSubscriptionUncheckedCreateNestedManyWithoutSubscriptionPlanInput = {
    create?: XOR<TenantSubscriptionCreateWithoutSubscriptionPlanInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput> | TenantSubscriptionCreateWithoutSubscriptionPlanInput[] | TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput | TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput[]
    createMany?: TenantSubscriptionCreateManySubscriptionPlanInputEnvelope
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type TenantSubscriptionUpdateManyWithoutSubscriptionPlanNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutSubscriptionPlanInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput> | TenantSubscriptionCreateWithoutSubscriptionPlanInput[] | TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput | TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput[]
    upsert?: TenantSubscriptionUpsertWithWhereUniqueWithoutSubscriptionPlanInput | TenantSubscriptionUpsertWithWhereUniqueWithoutSubscriptionPlanInput[]
    createMany?: TenantSubscriptionCreateManySubscriptionPlanInputEnvelope
    set?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    disconnect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    delete?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    update?: TenantSubscriptionUpdateWithWhereUniqueWithoutSubscriptionPlanInput | TenantSubscriptionUpdateWithWhereUniqueWithoutSubscriptionPlanInput[]
    updateMany?: TenantSubscriptionUpdateManyWithWhereWithoutSubscriptionPlanInput | TenantSubscriptionUpdateManyWithWhereWithoutSubscriptionPlanInput[]
    deleteMany?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type TenantSubscriptionUncheckedUpdateManyWithoutSubscriptionPlanNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutSubscriptionPlanInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput> | TenantSubscriptionCreateWithoutSubscriptionPlanInput[] | TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput | TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput[]
    upsert?: TenantSubscriptionUpsertWithWhereUniqueWithoutSubscriptionPlanInput | TenantSubscriptionUpsertWithWhereUniqueWithoutSubscriptionPlanInput[]
    createMany?: TenantSubscriptionCreateManySubscriptionPlanInputEnvelope
    set?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    disconnect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    delete?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    update?: TenantSubscriptionUpdateWithWhereUniqueWithoutSubscriptionPlanInput | TenantSubscriptionUpdateWithWhereUniqueWithoutSubscriptionPlanInput[]
    updateMany?: TenantSubscriptionUpdateManyWithWhereWithoutSubscriptionPlanInput | TenantSubscriptionUpdateManyWithWhereWithoutSubscriptionPlanInput[]
    deleteMany?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
  }

  export type TenantSubscriptionAddOnCreateNestedManyWithoutAddOnInput = {
    create?: XOR<TenantSubscriptionAddOnCreateWithoutAddOnInput, TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput> | TenantSubscriptionAddOnCreateWithoutAddOnInput[] | TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput[]
    connectOrCreate?: TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput | TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput[]
    createMany?: TenantSubscriptionAddOnCreateManyAddOnInputEnvelope
    connect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
  }

  export type TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutAddOnInput = {
    create?: XOR<TenantSubscriptionAddOnCreateWithoutAddOnInput, TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput> | TenantSubscriptionAddOnCreateWithoutAddOnInput[] | TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput[]
    connectOrCreate?: TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput | TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput[]
    createMany?: TenantSubscriptionAddOnCreateManyAddOnInputEnvelope
    connect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
  }

  export type TenantSubscriptionAddOnUpdateManyWithoutAddOnNestedInput = {
    create?: XOR<TenantSubscriptionAddOnCreateWithoutAddOnInput, TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput> | TenantSubscriptionAddOnCreateWithoutAddOnInput[] | TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput[]
    connectOrCreate?: TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput | TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput[]
    upsert?: TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutAddOnInput | TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutAddOnInput[]
    createMany?: TenantSubscriptionAddOnCreateManyAddOnInputEnvelope
    set?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    disconnect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    delete?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    connect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    update?: TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutAddOnInput | TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutAddOnInput[]
    updateMany?: TenantSubscriptionAddOnUpdateManyWithWhereWithoutAddOnInput | TenantSubscriptionAddOnUpdateManyWithWhereWithoutAddOnInput[]
    deleteMany?: TenantSubscriptionAddOnScalarWhereInput | TenantSubscriptionAddOnScalarWhereInput[]
  }

  export type TenantSubscriptionAddOnUncheckedUpdateManyWithoutAddOnNestedInput = {
    create?: XOR<TenantSubscriptionAddOnCreateWithoutAddOnInput, TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput> | TenantSubscriptionAddOnCreateWithoutAddOnInput[] | TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput[]
    connectOrCreate?: TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput | TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput[]
    upsert?: TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutAddOnInput | TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutAddOnInput[]
    createMany?: TenantSubscriptionAddOnCreateManyAddOnInputEnvelope
    set?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    disconnect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    delete?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    connect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    update?: TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutAddOnInput | TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutAddOnInput[]
    updateMany?: TenantSubscriptionAddOnUpdateManyWithWhereWithoutAddOnInput | TenantSubscriptionAddOnUpdateManyWithWhereWithoutAddOnInput[]
    deleteMany?: TenantSubscriptionAddOnScalarWhereInput | TenantSubscriptionAddOnScalarWhereInput[]
  }

  export type TenantUserCreateNestedManyWithoutTenantInput = {
    create?: XOR<TenantUserCreateWithoutTenantInput, TenantUserUncheckedCreateWithoutTenantInput> | TenantUserCreateWithoutTenantInput[] | TenantUserUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantUserCreateOrConnectWithoutTenantInput | TenantUserCreateOrConnectWithoutTenantInput[]
    createMany?: TenantUserCreateManyTenantInputEnvelope
    connect?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
  }

  export type TenantSubscriptionCreateNestedManyWithoutTenantInput = {
    create?: XOR<TenantSubscriptionCreateWithoutTenantInput, TenantSubscriptionUncheckedCreateWithoutTenantInput> | TenantSubscriptionCreateWithoutTenantInput[] | TenantSubscriptionUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutTenantInput | TenantSubscriptionCreateOrConnectWithoutTenantInput[]
    createMany?: TenantSubscriptionCreateManyTenantInputEnvelope
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
  }

  export type TenantOutletCreateNestedManyWithoutTenantInput = {
    create?: XOR<TenantOutletCreateWithoutTenantInput, TenantOutletUncheckedCreateWithoutTenantInput> | TenantOutletCreateWithoutTenantInput[] | TenantOutletUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantOutletCreateOrConnectWithoutTenantInput | TenantOutletCreateOrConnectWithoutTenantInput[]
    createMany?: TenantOutletCreateManyTenantInputEnvelope
    connect?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
  }

  export type PushyDeviceAllocationCreateNestedManyWithoutTenantInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutTenantInput, PushyDeviceAllocationUncheckedCreateWithoutTenantInput> | PushyDeviceAllocationCreateWithoutTenantInput[] | PushyDeviceAllocationUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutTenantInput | PushyDeviceAllocationCreateOrConnectWithoutTenantInput[]
    createMany?: PushyDeviceAllocationCreateManyTenantInputEnvelope
    connect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
  }

  export type TenantWarehouseCreateNestedManyWithoutTenantInput = {
    create?: XOR<TenantWarehouseCreateWithoutTenantInput, TenantWarehouseUncheckedCreateWithoutTenantInput> | TenantWarehouseCreateWithoutTenantInput[] | TenantWarehouseUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantWarehouseCreateOrConnectWithoutTenantInput | TenantWarehouseCreateOrConnectWithoutTenantInput[]
    createMany?: TenantWarehouseCreateManyTenantInputEnvelope
    connect?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
  }

  export type TenantUserUncheckedCreateNestedManyWithoutTenantInput = {
    create?: XOR<TenantUserCreateWithoutTenantInput, TenantUserUncheckedCreateWithoutTenantInput> | TenantUserCreateWithoutTenantInput[] | TenantUserUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantUserCreateOrConnectWithoutTenantInput | TenantUserCreateOrConnectWithoutTenantInput[]
    createMany?: TenantUserCreateManyTenantInputEnvelope
    connect?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
  }

  export type TenantSubscriptionUncheckedCreateNestedManyWithoutTenantInput = {
    create?: XOR<TenantSubscriptionCreateWithoutTenantInput, TenantSubscriptionUncheckedCreateWithoutTenantInput> | TenantSubscriptionCreateWithoutTenantInput[] | TenantSubscriptionUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutTenantInput | TenantSubscriptionCreateOrConnectWithoutTenantInput[]
    createMany?: TenantSubscriptionCreateManyTenantInputEnvelope
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
  }

  export type TenantOutletUncheckedCreateNestedManyWithoutTenantInput = {
    create?: XOR<TenantOutletCreateWithoutTenantInput, TenantOutletUncheckedCreateWithoutTenantInput> | TenantOutletCreateWithoutTenantInput[] | TenantOutletUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantOutletCreateOrConnectWithoutTenantInput | TenantOutletCreateOrConnectWithoutTenantInput[]
    createMany?: TenantOutletCreateManyTenantInputEnvelope
    connect?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
  }

  export type PushyDeviceAllocationUncheckedCreateNestedManyWithoutTenantInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutTenantInput, PushyDeviceAllocationUncheckedCreateWithoutTenantInput> | PushyDeviceAllocationCreateWithoutTenantInput[] | PushyDeviceAllocationUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutTenantInput | PushyDeviceAllocationCreateOrConnectWithoutTenantInput[]
    createMany?: PushyDeviceAllocationCreateManyTenantInputEnvelope
    connect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
  }

  export type TenantWarehouseUncheckedCreateNestedManyWithoutTenantInput = {
    create?: XOR<TenantWarehouseCreateWithoutTenantInput, TenantWarehouseUncheckedCreateWithoutTenantInput> | TenantWarehouseCreateWithoutTenantInput[] | TenantWarehouseUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantWarehouseCreateOrConnectWithoutTenantInput | TenantWarehouseCreateOrConnectWithoutTenantInput[]
    createMany?: TenantWarehouseCreateManyTenantInputEnvelope
    connect?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type TenantUserUpdateManyWithoutTenantNestedInput = {
    create?: XOR<TenantUserCreateWithoutTenantInput, TenantUserUncheckedCreateWithoutTenantInput> | TenantUserCreateWithoutTenantInput[] | TenantUserUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantUserCreateOrConnectWithoutTenantInput | TenantUserCreateOrConnectWithoutTenantInput[]
    upsert?: TenantUserUpsertWithWhereUniqueWithoutTenantInput | TenantUserUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: TenantUserCreateManyTenantInputEnvelope
    set?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
    disconnect?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
    delete?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
    connect?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
    update?: TenantUserUpdateWithWhereUniqueWithoutTenantInput | TenantUserUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: TenantUserUpdateManyWithWhereWithoutTenantInput | TenantUserUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: TenantUserScalarWhereInput | TenantUserScalarWhereInput[]
  }

  export type TenantSubscriptionUpdateManyWithoutTenantNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutTenantInput, TenantSubscriptionUncheckedCreateWithoutTenantInput> | TenantSubscriptionCreateWithoutTenantInput[] | TenantSubscriptionUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutTenantInput | TenantSubscriptionCreateOrConnectWithoutTenantInput[]
    upsert?: TenantSubscriptionUpsertWithWhereUniqueWithoutTenantInput | TenantSubscriptionUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: TenantSubscriptionCreateManyTenantInputEnvelope
    set?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    disconnect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    delete?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    update?: TenantSubscriptionUpdateWithWhereUniqueWithoutTenantInput | TenantSubscriptionUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: TenantSubscriptionUpdateManyWithWhereWithoutTenantInput | TenantSubscriptionUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
  }

  export type TenantOutletUpdateManyWithoutTenantNestedInput = {
    create?: XOR<TenantOutletCreateWithoutTenantInput, TenantOutletUncheckedCreateWithoutTenantInput> | TenantOutletCreateWithoutTenantInput[] | TenantOutletUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantOutletCreateOrConnectWithoutTenantInput | TenantOutletCreateOrConnectWithoutTenantInput[]
    upsert?: TenantOutletUpsertWithWhereUniqueWithoutTenantInput | TenantOutletUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: TenantOutletCreateManyTenantInputEnvelope
    set?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
    disconnect?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
    delete?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
    connect?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
    update?: TenantOutletUpdateWithWhereUniqueWithoutTenantInput | TenantOutletUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: TenantOutletUpdateManyWithWhereWithoutTenantInput | TenantOutletUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: TenantOutletScalarWhereInput | TenantOutletScalarWhereInput[]
  }

  export type PushyDeviceAllocationUpdateManyWithoutTenantNestedInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutTenantInput, PushyDeviceAllocationUncheckedCreateWithoutTenantInput> | PushyDeviceAllocationCreateWithoutTenantInput[] | PushyDeviceAllocationUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutTenantInput | PushyDeviceAllocationCreateOrConnectWithoutTenantInput[]
    upsert?: PushyDeviceAllocationUpsertWithWhereUniqueWithoutTenantInput | PushyDeviceAllocationUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: PushyDeviceAllocationCreateManyTenantInputEnvelope
    set?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    disconnect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    delete?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    connect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    update?: PushyDeviceAllocationUpdateWithWhereUniqueWithoutTenantInput | PushyDeviceAllocationUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: PushyDeviceAllocationUpdateManyWithWhereWithoutTenantInput | PushyDeviceAllocationUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: PushyDeviceAllocationScalarWhereInput | PushyDeviceAllocationScalarWhereInput[]
  }

  export type TenantWarehouseUpdateManyWithoutTenantNestedInput = {
    create?: XOR<TenantWarehouseCreateWithoutTenantInput, TenantWarehouseUncheckedCreateWithoutTenantInput> | TenantWarehouseCreateWithoutTenantInput[] | TenantWarehouseUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantWarehouseCreateOrConnectWithoutTenantInput | TenantWarehouseCreateOrConnectWithoutTenantInput[]
    upsert?: TenantWarehouseUpsertWithWhereUniqueWithoutTenantInput | TenantWarehouseUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: TenantWarehouseCreateManyTenantInputEnvelope
    set?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
    disconnect?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
    delete?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
    connect?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
    update?: TenantWarehouseUpdateWithWhereUniqueWithoutTenantInput | TenantWarehouseUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: TenantWarehouseUpdateManyWithWhereWithoutTenantInput | TenantWarehouseUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: TenantWarehouseScalarWhereInput | TenantWarehouseScalarWhereInput[]
  }

  export type TenantUserUncheckedUpdateManyWithoutTenantNestedInput = {
    create?: XOR<TenantUserCreateWithoutTenantInput, TenantUserUncheckedCreateWithoutTenantInput> | TenantUserCreateWithoutTenantInput[] | TenantUserUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantUserCreateOrConnectWithoutTenantInput | TenantUserCreateOrConnectWithoutTenantInput[]
    upsert?: TenantUserUpsertWithWhereUniqueWithoutTenantInput | TenantUserUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: TenantUserCreateManyTenantInputEnvelope
    set?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
    disconnect?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
    delete?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
    connect?: TenantUserWhereUniqueInput | TenantUserWhereUniqueInput[]
    update?: TenantUserUpdateWithWhereUniqueWithoutTenantInput | TenantUserUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: TenantUserUpdateManyWithWhereWithoutTenantInput | TenantUserUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: TenantUserScalarWhereInput | TenantUserScalarWhereInput[]
  }

  export type TenantSubscriptionUncheckedUpdateManyWithoutTenantNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutTenantInput, TenantSubscriptionUncheckedCreateWithoutTenantInput> | TenantSubscriptionCreateWithoutTenantInput[] | TenantSubscriptionUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutTenantInput | TenantSubscriptionCreateOrConnectWithoutTenantInput[]
    upsert?: TenantSubscriptionUpsertWithWhereUniqueWithoutTenantInput | TenantSubscriptionUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: TenantSubscriptionCreateManyTenantInputEnvelope
    set?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    disconnect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    delete?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    update?: TenantSubscriptionUpdateWithWhereUniqueWithoutTenantInput | TenantSubscriptionUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: TenantSubscriptionUpdateManyWithWhereWithoutTenantInput | TenantSubscriptionUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
  }

  export type TenantOutletUncheckedUpdateManyWithoutTenantNestedInput = {
    create?: XOR<TenantOutletCreateWithoutTenantInput, TenantOutletUncheckedCreateWithoutTenantInput> | TenantOutletCreateWithoutTenantInput[] | TenantOutletUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantOutletCreateOrConnectWithoutTenantInput | TenantOutletCreateOrConnectWithoutTenantInput[]
    upsert?: TenantOutletUpsertWithWhereUniqueWithoutTenantInput | TenantOutletUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: TenantOutletCreateManyTenantInputEnvelope
    set?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
    disconnect?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
    delete?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
    connect?: TenantOutletWhereUniqueInput | TenantOutletWhereUniqueInput[]
    update?: TenantOutletUpdateWithWhereUniqueWithoutTenantInput | TenantOutletUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: TenantOutletUpdateManyWithWhereWithoutTenantInput | TenantOutletUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: TenantOutletScalarWhereInput | TenantOutletScalarWhereInput[]
  }

  export type PushyDeviceAllocationUncheckedUpdateManyWithoutTenantNestedInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutTenantInput, PushyDeviceAllocationUncheckedCreateWithoutTenantInput> | PushyDeviceAllocationCreateWithoutTenantInput[] | PushyDeviceAllocationUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutTenantInput | PushyDeviceAllocationCreateOrConnectWithoutTenantInput[]
    upsert?: PushyDeviceAllocationUpsertWithWhereUniqueWithoutTenantInput | PushyDeviceAllocationUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: PushyDeviceAllocationCreateManyTenantInputEnvelope
    set?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    disconnect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    delete?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    connect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    update?: PushyDeviceAllocationUpdateWithWhereUniqueWithoutTenantInput | PushyDeviceAllocationUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: PushyDeviceAllocationUpdateManyWithWhereWithoutTenantInput | PushyDeviceAllocationUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: PushyDeviceAllocationScalarWhereInput | PushyDeviceAllocationScalarWhereInput[]
  }

  export type TenantWarehouseUncheckedUpdateManyWithoutTenantNestedInput = {
    create?: XOR<TenantWarehouseCreateWithoutTenantInput, TenantWarehouseUncheckedCreateWithoutTenantInput> | TenantWarehouseCreateWithoutTenantInput[] | TenantWarehouseUncheckedCreateWithoutTenantInput[]
    connectOrCreate?: TenantWarehouseCreateOrConnectWithoutTenantInput | TenantWarehouseCreateOrConnectWithoutTenantInput[]
    upsert?: TenantWarehouseUpsertWithWhereUniqueWithoutTenantInput | TenantWarehouseUpsertWithWhereUniqueWithoutTenantInput[]
    createMany?: TenantWarehouseCreateManyTenantInputEnvelope
    set?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
    disconnect?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
    delete?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
    connect?: TenantWarehouseWhereUniqueInput | TenantWarehouseWhereUniqueInput[]
    update?: TenantWarehouseUpdateWithWhereUniqueWithoutTenantInput | TenantWarehouseUpdateWithWhereUniqueWithoutTenantInput[]
    updateMany?: TenantWarehouseUpdateManyWithWhereWithoutTenantInput | TenantWarehouseUpdateManyWithWhereWithoutTenantInput[]
    deleteMany?: TenantWarehouseScalarWhereInput | TenantWarehouseScalarWhereInput[]
  }

  export type TenantOutletCreateNestedOneWithoutSubscriptionsInput = {
    create?: XOR<TenantOutletCreateWithoutSubscriptionsInput, TenantOutletUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: TenantOutletCreateOrConnectWithoutSubscriptionsInput
    connect?: TenantOutletWhereUniqueInput
  }

  export type DiscountCreateNestedOneWithoutSubscriptionsInput = {
    create?: XOR<DiscountCreateWithoutSubscriptionsInput, DiscountUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: DiscountCreateOrConnectWithoutSubscriptionsInput
    connect?: DiscountWhereUniqueInput
  }

  export type TenantCreateNestedOneWithoutSubscriptionInput = {
    create?: XOR<TenantCreateWithoutSubscriptionInput, TenantUncheckedCreateWithoutSubscriptionInput>
    connectOrCreate?: TenantCreateOrConnectWithoutSubscriptionInput
    connect?: TenantWhereUniqueInput
  }

  export type SubscriptionPlanCreateNestedOneWithoutSubscriptionInput = {
    create?: XOR<SubscriptionPlanCreateWithoutSubscriptionInput, SubscriptionPlanUncheckedCreateWithoutSubscriptionInput>
    connectOrCreate?: SubscriptionPlanCreateOrConnectWithoutSubscriptionInput
    connect?: SubscriptionPlanWhereUniqueInput
  }

  export type TenantSubscriptionAddOnCreateNestedManyWithoutTenantSubscriptionInput = {
    create?: XOR<TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput, TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput> | TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput[] | TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput[]
    connectOrCreate?: TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput | TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput[]
    createMany?: TenantSubscriptionAddOnCreateManyTenantSubscriptionInputEnvelope
    connect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
  }

  export type PushyDeviceAllocationCreateNestedManyWithoutSubscriptionInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutSubscriptionInput, PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput> | PushyDeviceAllocationCreateWithoutSubscriptionInput[] | PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput[]
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput | PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput[]
    createMany?: PushyDeviceAllocationCreateManySubscriptionInputEnvelope
    connect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
  }

  export type TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutTenantSubscriptionInput = {
    create?: XOR<TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput, TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput> | TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput[] | TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput[]
    connectOrCreate?: TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput | TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput[]
    createMany?: TenantSubscriptionAddOnCreateManyTenantSubscriptionInputEnvelope
    connect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
  }

  export type PushyDeviceAllocationUncheckedCreateNestedManyWithoutSubscriptionInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutSubscriptionInput, PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput> | PushyDeviceAllocationCreateWithoutSubscriptionInput[] | PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput[]
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput | PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput[]
    createMany?: PushyDeviceAllocationCreateManySubscriptionInputEnvelope
    connect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
  }

  export type TenantOutletUpdateOneRequiredWithoutSubscriptionsNestedInput = {
    create?: XOR<TenantOutletCreateWithoutSubscriptionsInput, TenantOutletUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: TenantOutletCreateOrConnectWithoutSubscriptionsInput
    upsert?: TenantOutletUpsertWithoutSubscriptionsInput
    connect?: TenantOutletWhereUniqueInput
    update?: XOR<XOR<TenantOutletUpdateToOneWithWhereWithoutSubscriptionsInput, TenantOutletUpdateWithoutSubscriptionsInput>, TenantOutletUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type DiscountUpdateOneWithoutSubscriptionsNestedInput = {
    create?: XOR<DiscountCreateWithoutSubscriptionsInput, DiscountUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: DiscountCreateOrConnectWithoutSubscriptionsInput
    upsert?: DiscountUpsertWithoutSubscriptionsInput
    disconnect?: DiscountWhereInput | boolean
    delete?: DiscountWhereInput | boolean
    connect?: DiscountWhereUniqueInput
    update?: XOR<XOR<DiscountUpdateToOneWithWhereWithoutSubscriptionsInput, DiscountUpdateWithoutSubscriptionsInput>, DiscountUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type TenantUpdateOneRequiredWithoutSubscriptionNestedInput = {
    create?: XOR<TenantCreateWithoutSubscriptionInput, TenantUncheckedCreateWithoutSubscriptionInput>
    connectOrCreate?: TenantCreateOrConnectWithoutSubscriptionInput
    upsert?: TenantUpsertWithoutSubscriptionInput
    connect?: TenantWhereUniqueInput
    update?: XOR<XOR<TenantUpdateToOneWithWhereWithoutSubscriptionInput, TenantUpdateWithoutSubscriptionInput>, TenantUncheckedUpdateWithoutSubscriptionInput>
  }

  export type SubscriptionPlanUpdateOneRequiredWithoutSubscriptionNestedInput = {
    create?: XOR<SubscriptionPlanCreateWithoutSubscriptionInput, SubscriptionPlanUncheckedCreateWithoutSubscriptionInput>
    connectOrCreate?: SubscriptionPlanCreateOrConnectWithoutSubscriptionInput
    upsert?: SubscriptionPlanUpsertWithoutSubscriptionInput
    connect?: SubscriptionPlanWhereUniqueInput
    update?: XOR<XOR<SubscriptionPlanUpdateToOneWithWhereWithoutSubscriptionInput, SubscriptionPlanUpdateWithoutSubscriptionInput>, SubscriptionPlanUncheckedUpdateWithoutSubscriptionInput>
  }

  export type TenantSubscriptionAddOnUpdateManyWithoutTenantSubscriptionNestedInput = {
    create?: XOR<TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput, TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput> | TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput[] | TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput[]
    connectOrCreate?: TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput | TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput[]
    upsert?: TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutTenantSubscriptionInput | TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutTenantSubscriptionInput[]
    createMany?: TenantSubscriptionAddOnCreateManyTenantSubscriptionInputEnvelope
    set?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    disconnect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    delete?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    connect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    update?: TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutTenantSubscriptionInput | TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutTenantSubscriptionInput[]
    updateMany?: TenantSubscriptionAddOnUpdateManyWithWhereWithoutTenantSubscriptionInput | TenantSubscriptionAddOnUpdateManyWithWhereWithoutTenantSubscriptionInput[]
    deleteMany?: TenantSubscriptionAddOnScalarWhereInput | TenantSubscriptionAddOnScalarWhereInput[]
  }

  export type PushyDeviceAllocationUpdateManyWithoutSubscriptionNestedInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutSubscriptionInput, PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput> | PushyDeviceAllocationCreateWithoutSubscriptionInput[] | PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput[]
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput | PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput[]
    upsert?: PushyDeviceAllocationUpsertWithWhereUniqueWithoutSubscriptionInput | PushyDeviceAllocationUpsertWithWhereUniqueWithoutSubscriptionInput[]
    createMany?: PushyDeviceAllocationCreateManySubscriptionInputEnvelope
    set?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    disconnect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    delete?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    connect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    update?: PushyDeviceAllocationUpdateWithWhereUniqueWithoutSubscriptionInput | PushyDeviceAllocationUpdateWithWhereUniqueWithoutSubscriptionInput[]
    updateMany?: PushyDeviceAllocationUpdateManyWithWhereWithoutSubscriptionInput | PushyDeviceAllocationUpdateManyWithWhereWithoutSubscriptionInput[]
    deleteMany?: PushyDeviceAllocationScalarWhereInput | PushyDeviceAllocationScalarWhereInput[]
  }

  export type TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionNestedInput = {
    create?: XOR<TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput, TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput> | TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput[] | TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput[]
    connectOrCreate?: TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput | TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput[]
    upsert?: TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutTenantSubscriptionInput | TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutTenantSubscriptionInput[]
    createMany?: TenantSubscriptionAddOnCreateManyTenantSubscriptionInputEnvelope
    set?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    disconnect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    delete?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    connect?: TenantSubscriptionAddOnWhereUniqueInput | TenantSubscriptionAddOnWhereUniqueInput[]
    update?: TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutTenantSubscriptionInput | TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutTenantSubscriptionInput[]
    updateMany?: TenantSubscriptionAddOnUpdateManyWithWhereWithoutTenantSubscriptionInput | TenantSubscriptionAddOnUpdateManyWithWhereWithoutTenantSubscriptionInput[]
    deleteMany?: TenantSubscriptionAddOnScalarWhereInput | TenantSubscriptionAddOnScalarWhereInput[]
  }

  export type PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionNestedInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutSubscriptionInput, PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput> | PushyDeviceAllocationCreateWithoutSubscriptionInput[] | PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput[]
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput | PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput[]
    upsert?: PushyDeviceAllocationUpsertWithWhereUniqueWithoutSubscriptionInput | PushyDeviceAllocationUpsertWithWhereUniqueWithoutSubscriptionInput[]
    createMany?: PushyDeviceAllocationCreateManySubscriptionInputEnvelope
    set?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    disconnect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    delete?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    connect?: PushyDeviceAllocationWhereUniqueInput | PushyDeviceAllocationWhereUniqueInput[]
    update?: PushyDeviceAllocationUpdateWithWhereUniqueWithoutSubscriptionInput | PushyDeviceAllocationUpdateWithWhereUniqueWithoutSubscriptionInput[]
    updateMany?: PushyDeviceAllocationUpdateManyWithWhereWithoutSubscriptionInput | PushyDeviceAllocationUpdateManyWithWhereWithoutSubscriptionInput[]
    deleteMany?: PushyDeviceAllocationScalarWhereInput | PushyDeviceAllocationScalarWhereInput[]
  }

  export type TenantSubscriptionCreateNestedOneWithoutSubscriptionAddOnInput = {
    create?: XOR<TenantSubscriptionCreateWithoutSubscriptionAddOnInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionAddOnInput>
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutSubscriptionAddOnInput
    connect?: TenantSubscriptionWhereUniqueInput
  }

  export type SubscriptionAddOnCreateNestedOneWithoutSubscriptionsInput = {
    create?: XOR<SubscriptionAddOnCreateWithoutSubscriptionsInput, SubscriptionAddOnUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: SubscriptionAddOnCreateOrConnectWithoutSubscriptionsInput
    connect?: SubscriptionAddOnWhereUniqueInput
  }

  export type TenantSubscriptionUpdateOneRequiredWithoutSubscriptionAddOnNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutSubscriptionAddOnInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionAddOnInput>
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutSubscriptionAddOnInput
    upsert?: TenantSubscriptionUpsertWithoutSubscriptionAddOnInput
    connect?: TenantSubscriptionWhereUniqueInput
    update?: XOR<XOR<TenantSubscriptionUpdateToOneWithWhereWithoutSubscriptionAddOnInput, TenantSubscriptionUpdateWithoutSubscriptionAddOnInput>, TenantSubscriptionUncheckedUpdateWithoutSubscriptionAddOnInput>
  }

  export type SubscriptionAddOnUpdateOneRequiredWithoutSubscriptionsNestedInput = {
    create?: XOR<SubscriptionAddOnCreateWithoutSubscriptionsInput, SubscriptionAddOnUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: SubscriptionAddOnCreateOrConnectWithoutSubscriptionsInput
    upsert?: SubscriptionAddOnUpsertWithoutSubscriptionsInput
    connect?: SubscriptionAddOnWhereUniqueInput
    update?: XOR<XOR<SubscriptionAddOnUpdateToOneWithWhereWithoutSubscriptionsInput, SubscriptionAddOnUpdateWithoutSubscriptionsInput>, SubscriptionAddOnUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type TenantCreateNestedOneWithoutTenantOutletsInput = {
    create?: XOR<TenantCreateWithoutTenantOutletsInput, TenantUncheckedCreateWithoutTenantOutletsInput>
    connectOrCreate?: TenantCreateOrConnectWithoutTenantOutletsInput
    connect?: TenantWhereUniqueInput
  }

  export type TenantSubscriptionCreateNestedManyWithoutOutletInput = {
    create?: XOR<TenantSubscriptionCreateWithoutOutletInput, TenantSubscriptionUncheckedCreateWithoutOutletInput> | TenantSubscriptionCreateWithoutOutletInput[] | TenantSubscriptionUncheckedCreateWithoutOutletInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutOutletInput | TenantSubscriptionCreateOrConnectWithoutOutletInput[]
    createMany?: TenantSubscriptionCreateManyOutletInputEnvelope
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
  }

  export type TenantSubscriptionUncheckedCreateNestedManyWithoutOutletInput = {
    create?: XOR<TenantSubscriptionCreateWithoutOutletInput, TenantSubscriptionUncheckedCreateWithoutOutletInput> | TenantSubscriptionCreateWithoutOutletInput[] | TenantSubscriptionUncheckedCreateWithoutOutletInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutOutletInput | TenantSubscriptionCreateOrConnectWithoutOutletInput[]
    createMany?: TenantSubscriptionCreateManyOutletInputEnvelope
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type TenantUpdateOneRequiredWithoutTenantOutletsNestedInput = {
    create?: XOR<TenantCreateWithoutTenantOutletsInput, TenantUncheckedCreateWithoutTenantOutletsInput>
    connectOrCreate?: TenantCreateOrConnectWithoutTenantOutletsInput
    upsert?: TenantUpsertWithoutTenantOutletsInput
    connect?: TenantWhereUniqueInput
    update?: XOR<XOR<TenantUpdateToOneWithWhereWithoutTenantOutletsInput, TenantUpdateWithoutTenantOutletsInput>, TenantUncheckedUpdateWithoutTenantOutletsInput>
  }

  export type TenantSubscriptionUpdateManyWithoutOutletNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutOutletInput, TenantSubscriptionUncheckedCreateWithoutOutletInput> | TenantSubscriptionCreateWithoutOutletInput[] | TenantSubscriptionUncheckedCreateWithoutOutletInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutOutletInput | TenantSubscriptionCreateOrConnectWithoutOutletInput[]
    upsert?: TenantSubscriptionUpsertWithWhereUniqueWithoutOutletInput | TenantSubscriptionUpsertWithWhereUniqueWithoutOutletInput[]
    createMany?: TenantSubscriptionCreateManyOutletInputEnvelope
    set?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    disconnect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    delete?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    update?: TenantSubscriptionUpdateWithWhereUniqueWithoutOutletInput | TenantSubscriptionUpdateWithWhereUniqueWithoutOutletInput[]
    updateMany?: TenantSubscriptionUpdateManyWithWhereWithoutOutletInput | TenantSubscriptionUpdateManyWithWhereWithoutOutletInput[]
    deleteMany?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
  }

  export type TenantSubscriptionUncheckedUpdateManyWithoutOutletNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutOutletInput, TenantSubscriptionUncheckedCreateWithoutOutletInput> | TenantSubscriptionCreateWithoutOutletInput[] | TenantSubscriptionUncheckedCreateWithoutOutletInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutOutletInput | TenantSubscriptionCreateOrConnectWithoutOutletInput[]
    upsert?: TenantSubscriptionUpsertWithWhereUniqueWithoutOutletInput | TenantSubscriptionUpsertWithWhereUniqueWithoutOutletInput[]
    createMany?: TenantSubscriptionCreateManyOutletInputEnvelope
    set?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    disconnect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    delete?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    update?: TenantSubscriptionUpdateWithWhereUniqueWithoutOutletInput | TenantSubscriptionUpdateWithWhereUniqueWithoutOutletInput[]
    updateMany?: TenantSubscriptionUpdateManyWithWhereWithoutOutletInput | TenantSubscriptionUpdateManyWithWhereWithoutOutletInput[]
    deleteMany?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
  }

  export type TenantSubscriptionCreateNestedManyWithoutDiscountInput = {
    create?: XOR<TenantSubscriptionCreateWithoutDiscountInput, TenantSubscriptionUncheckedCreateWithoutDiscountInput> | TenantSubscriptionCreateWithoutDiscountInput[] | TenantSubscriptionUncheckedCreateWithoutDiscountInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutDiscountInput | TenantSubscriptionCreateOrConnectWithoutDiscountInput[]
    createMany?: TenantSubscriptionCreateManyDiscountInputEnvelope
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
  }

  export type TenantSubscriptionUncheckedCreateNestedManyWithoutDiscountInput = {
    create?: XOR<TenantSubscriptionCreateWithoutDiscountInput, TenantSubscriptionUncheckedCreateWithoutDiscountInput> | TenantSubscriptionCreateWithoutDiscountInput[] | TenantSubscriptionUncheckedCreateWithoutDiscountInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutDiscountInput | TenantSubscriptionCreateOrConnectWithoutDiscountInput[]
    createMany?: TenantSubscriptionCreateManyDiscountInputEnvelope
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type TenantSubscriptionUpdateManyWithoutDiscountNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutDiscountInput, TenantSubscriptionUncheckedCreateWithoutDiscountInput> | TenantSubscriptionCreateWithoutDiscountInput[] | TenantSubscriptionUncheckedCreateWithoutDiscountInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutDiscountInput | TenantSubscriptionCreateOrConnectWithoutDiscountInput[]
    upsert?: TenantSubscriptionUpsertWithWhereUniqueWithoutDiscountInput | TenantSubscriptionUpsertWithWhereUniqueWithoutDiscountInput[]
    createMany?: TenantSubscriptionCreateManyDiscountInputEnvelope
    set?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    disconnect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    delete?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    update?: TenantSubscriptionUpdateWithWhereUniqueWithoutDiscountInput | TenantSubscriptionUpdateWithWhereUniqueWithoutDiscountInput[]
    updateMany?: TenantSubscriptionUpdateManyWithWhereWithoutDiscountInput | TenantSubscriptionUpdateManyWithWhereWithoutDiscountInput[]
    deleteMany?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
  }

  export type TenantSubscriptionUncheckedUpdateManyWithoutDiscountNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutDiscountInput, TenantSubscriptionUncheckedCreateWithoutDiscountInput> | TenantSubscriptionCreateWithoutDiscountInput[] | TenantSubscriptionUncheckedCreateWithoutDiscountInput[]
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutDiscountInput | TenantSubscriptionCreateOrConnectWithoutDiscountInput[]
    upsert?: TenantSubscriptionUpsertWithWhereUniqueWithoutDiscountInput | TenantSubscriptionUpsertWithWhereUniqueWithoutDiscountInput[]
    createMany?: TenantSubscriptionCreateManyDiscountInputEnvelope
    set?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    disconnect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    delete?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    connect?: TenantSubscriptionWhereUniqueInput | TenantSubscriptionWhereUniqueInput[]
    update?: TenantSubscriptionUpdateWithWhereUniqueWithoutDiscountInput | TenantSubscriptionUpdateWithWhereUniqueWithoutDiscountInput[]
    updateMany?: TenantSubscriptionUpdateManyWithWhereWithoutDiscountInput | TenantSubscriptionUpdateManyWithWhereWithoutDiscountInput[]
    deleteMany?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
  }

  export type TenantCreateNestedOneWithoutTenantUsersInput = {
    create?: XOR<TenantCreateWithoutTenantUsersInput, TenantUncheckedCreateWithoutTenantUsersInput>
    connectOrCreate?: TenantCreateOrConnectWithoutTenantUsersInput
    connect?: TenantWhereUniqueInput
  }

  export type PushyDeviceCreateNestedManyWithoutTenantUserInput = {
    create?: XOR<PushyDeviceCreateWithoutTenantUserInput, PushyDeviceUncheckedCreateWithoutTenantUserInput> | PushyDeviceCreateWithoutTenantUserInput[] | PushyDeviceUncheckedCreateWithoutTenantUserInput[]
    connectOrCreate?: PushyDeviceCreateOrConnectWithoutTenantUserInput | PushyDeviceCreateOrConnectWithoutTenantUserInput[]
    createMany?: PushyDeviceCreateManyTenantUserInputEnvelope
    connect?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
  }

  export type PushyDeviceUncheckedCreateNestedManyWithoutTenantUserInput = {
    create?: XOR<PushyDeviceCreateWithoutTenantUserInput, PushyDeviceUncheckedCreateWithoutTenantUserInput> | PushyDeviceCreateWithoutTenantUserInput[] | PushyDeviceUncheckedCreateWithoutTenantUserInput[]
    connectOrCreate?: PushyDeviceCreateOrConnectWithoutTenantUserInput | PushyDeviceCreateOrConnectWithoutTenantUserInput[]
    createMany?: PushyDeviceCreateManyTenantUserInputEnvelope
    connect?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
  }

  export type TenantUpdateOneWithoutTenantUsersNestedInput = {
    create?: XOR<TenantCreateWithoutTenantUsersInput, TenantUncheckedCreateWithoutTenantUsersInput>
    connectOrCreate?: TenantCreateOrConnectWithoutTenantUsersInput
    upsert?: TenantUpsertWithoutTenantUsersInput
    disconnect?: TenantWhereInput | boolean
    delete?: TenantWhereInput | boolean
    connect?: TenantWhereUniqueInput
    update?: XOR<XOR<TenantUpdateToOneWithWhereWithoutTenantUsersInput, TenantUpdateWithoutTenantUsersInput>, TenantUncheckedUpdateWithoutTenantUsersInput>
  }

  export type PushyDeviceUpdateManyWithoutTenantUserNestedInput = {
    create?: XOR<PushyDeviceCreateWithoutTenantUserInput, PushyDeviceUncheckedCreateWithoutTenantUserInput> | PushyDeviceCreateWithoutTenantUserInput[] | PushyDeviceUncheckedCreateWithoutTenantUserInput[]
    connectOrCreate?: PushyDeviceCreateOrConnectWithoutTenantUserInput | PushyDeviceCreateOrConnectWithoutTenantUserInput[]
    upsert?: PushyDeviceUpsertWithWhereUniqueWithoutTenantUserInput | PushyDeviceUpsertWithWhereUniqueWithoutTenantUserInput[]
    createMany?: PushyDeviceCreateManyTenantUserInputEnvelope
    set?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
    disconnect?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
    delete?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
    connect?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
    update?: PushyDeviceUpdateWithWhereUniqueWithoutTenantUserInput | PushyDeviceUpdateWithWhereUniqueWithoutTenantUserInput[]
    updateMany?: PushyDeviceUpdateManyWithWhereWithoutTenantUserInput | PushyDeviceUpdateManyWithWhereWithoutTenantUserInput[]
    deleteMany?: PushyDeviceScalarWhereInput | PushyDeviceScalarWhereInput[]
  }

  export type PushyDeviceUncheckedUpdateManyWithoutTenantUserNestedInput = {
    create?: XOR<PushyDeviceCreateWithoutTenantUserInput, PushyDeviceUncheckedCreateWithoutTenantUserInput> | PushyDeviceCreateWithoutTenantUserInput[] | PushyDeviceUncheckedCreateWithoutTenantUserInput[]
    connectOrCreate?: PushyDeviceCreateOrConnectWithoutTenantUserInput | PushyDeviceCreateOrConnectWithoutTenantUserInput[]
    upsert?: PushyDeviceUpsertWithWhereUniqueWithoutTenantUserInput | PushyDeviceUpsertWithWhereUniqueWithoutTenantUserInput[]
    createMany?: PushyDeviceCreateManyTenantUserInputEnvelope
    set?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
    disconnect?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
    delete?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
    connect?: PushyDeviceWhereUniqueInput | PushyDeviceWhereUniqueInput[]
    update?: PushyDeviceUpdateWithWhereUniqueWithoutTenantUserInput | PushyDeviceUpdateWithWhereUniqueWithoutTenantUserInput[]
    updateMany?: PushyDeviceUpdateManyWithWhereWithoutTenantUserInput | PushyDeviceUpdateManyWithWhereWithoutTenantUserInput[]
    deleteMany?: PushyDeviceScalarWhereInput | PushyDeviceScalarWhereInput[]
  }

  export type TenantUserCreateNestedOneWithoutPushyDevicesInput = {
    create?: XOR<TenantUserCreateWithoutPushyDevicesInput, TenantUserUncheckedCreateWithoutPushyDevicesInput>
    connectOrCreate?: TenantUserCreateOrConnectWithoutPushyDevicesInput
    connect?: TenantUserWhereUniqueInput
  }

  export type PushySubscriptionCreateNestedManyWithoutDeviceInput = {
    create?: XOR<PushySubscriptionCreateWithoutDeviceInput, PushySubscriptionUncheckedCreateWithoutDeviceInput> | PushySubscriptionCreateWithoutDeviceInput[] | PushySubscriptionUncheckedCreateWithoutDeviceInput[]
    connectOrCreate?: PushySubscriptionCreateOrConnectWithoutDeviceInput | PushySubscriptionCreateOrConnectWithoutDeviceInput[]
    createMany?: PushySubscriptionCreateManyDeviceInputEnvelope
    connect?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
  }

  export type PushyDeviceAllocationCreateNestedOneWithoutDeviceInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutDeviceInput, PushyDeviceAllocationUncheckedCreateWithoutDeviceInput>
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutDeviceInput
    connect?: PushyDeviceAllocationWhereUniqueInput
  }

  export type PushySubscriptionUncheckedCreateNestedManyWithoutDeviceInput = {
    create?: XOR<PushySubscriptionCreateWithoutDeviceInput, PushySubscriptionUncheckedCreateWithoutDeviceInput> | PushySubscriptionCreateWithoutDeviceInput[] | PushySubscriptionUncheckedCreateWithoutDeviceInput[]
    connectOrCreate?: PushySubscriptionCreateOrConnectWithoutDeviceInput | PushySubscriptionCreateOrConnectWithoutDeviceInput[]
    createMany?: PushySubscriptionCreateManyDeviceInputEnvelope
    connect?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
  }

  export type PushyDeviceAllocationUncheckedCreateNestedOneWithoutDeviceInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutDeviceInput, PushyDeviceAllocationUncheckedCreateWithoutDeviceInput>
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutDeviceInput
    connect?: PushyDeviceAllocationWhereUniqueInput
  }

  export type TenantUserUpdateOneRequiredWithoutPushyDevicesNestedInput = {
    create?: XOR<TenantUserCreateWithoutPushyDevicesInput, TenantUserUncheckedCreateWithoutPushyDevicesInput>
    connectOrCreate?: TenantUserCreateOrConnectWithoutPushyDevicesInput
    upsert?: TenantUserUpsertWithoutPushyDevicesInput
    connect?: TenantUserWhereUniqueInput
    update?: XOR<XOR<TenantUserUpdateToOneWithWhereWithoutPushyDevicesInput, TenantUserUpdateWithoutPushyDevicesInput>, TenantUserUncheckedUpdateWithoutPushyDevicesInput>
  }

  export type PushySubscriptionUpdateManyWithoutDeviceNestedInput = {
    create?: XOR<PushySubscriptionCreateWithoutDeviceInput, PushySubscriptionUncheckedCreateWithoutDeviceInput> | PushySubscriptionCreateWithoutDeviceInput[] | PushySubscriptionUncheckedCreateWithoutDeviceInput[]
    connectOrCreate?: PushySubscriptionCreateOrConnectWithoutDeviceInput | PushySubscriptionCreateOrConnectWithoutDeviceInput[]
    upsert?: PushySubscriptionUpsertWithWhereUniqueWithoutDeviceInput | PushySubscriptionUpsertWithWhereUniqueWithoutDeviceInput[]
    createMany?: PushySubscriptionCreateManyDeviceInputEnvelope
    set?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
    disconnect?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
    delete?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
    connect?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
    update?: PushySubscriptionUpdateWithWhereUniqueWithoutDeviceInput | PushySubscriptionUpdateWithWhereUniqueWithoutDeviceInput[]
    updateMany?: PushySubscriptionUpdateManyWithWhereWithoutDeviceInput | PushySubscriptionUpdateManyWithWhereWithoutDeviceInput[]
    deleteMany?: PushySubscriptionScalarWhereInput | PushySubscriptionScalarWhereInput[]
  }

  export type PushyDeviceAllocationUpdateOneWithoutDeviceNestedInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutDeviceInput, PushyDeviceAllocationUncheckedCreateWithoutDeviceInput>
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutDeviceInput
    upsert?: PushyDeviceAllocationUpsertWithoutDeviceInput
    disconnect?: PushyDeviceAllocationWhereInput | boolean
    delete?: PushyDeviceAllocationWhereInput | boolean
    connect?: PushyDeviceAllocationWhereUniqueInput
    update?: XOR<XOR<PushyDeviceAllocationUpdateToOneWithWhereWithoutDeviceInput, PushyDeviceAllocationUpdateWithoutDeviceInput>, PushyDeviceAllocationUncheckedUpdateWithoutDeviceInput>
  }

  export type PushySubscriptionUncheckedUpdateManyWithoutDeviceNestedInput = {
    create?: XOR<PushySubscriptionCreateWithoutDeviceInput, PushySubscriptionUncheckedCreateWithoutDeviceInput> | PushySubscriptionCreateWithoutDeviceInput[] | PushySubscriptionUncheckedCreateWithoutDeviceInput[]
    connectOrCreate?: PushySubscriptionCreateOrConnectWithoutDeviceInput | PushySubscriptionCreateOrConnectWithoutDeviceInput[]
    upsert?: PushySubscriptionUpsertWithWhereUniqueWithoutDeviceInput | PushySubscriptionUpsertWithWhereUniqueWithoutDeviceInput[]
    createMany?: PushySubscriptionCreateManyDeviceInputEnvelope
    set?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
    disconnect?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
    delete?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
    connect?: PushySubscriptionWhereUniqueInput | PushySubscriptionWhereUniqueInput[]
    update?: PushySubscriptionUpdateWithWhereUniqueWithoutDeviceInput | PushySubscriptionUpdateWithWhereUniqueWithoutDeviceInput[]
    updateMany?: PushySubscriptionUpdateManyWithWhereWithoutDeviceInput | PushySubscriptionUpdateManyWithWhereWithoutDeviceInput[]
    deleteMany?: PushySubscriptionScalarWhereInput | PushySubscriptionScalarWhereInput[]
  }

  export type PushyDeviceAllocationUncheckedUpdateOneWithoutDeviceNestedInput = {
    create?: XOR<PushyDeviceAllocationCreateWithoutDeviceInput, PushyDeviceAllocationUncheckedCreateWithoutDeviceInput>
    connectOrCreate?: PushyDeviceAllocationCreateOrConnectWithoutDeviceInput
    upsert?: PushyDeviceAllocationUpsertWithoutDeviceInput
    disconnect?: PushyDeviceAllocationWhereInput | boolean
    delete?: PushyDeviceAllocationWhereInput | boolean
    connect?: PushyDeviceAllocationWhereUniqueInput
    update?: XOR<XOR<PushyDeviceAllocationUpdateToOneWithWhereWithoutDeviceInput, PushyDeviceAllocationUpdateWithoutDeviceInput>, PushyDeviceAllocationUncheckedUpdateWithoutDeviceInput>
  }

  export type PushyDeviceCreateNestedOneWithoutSubscriptionsInput = {
    create?: XOR<PushyDeviceCreateWithoutSubscriptionsInput, PushyDeviceUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: PushyDeviceCreateOrConnectWithoutSubscriptionsInput
    connect?: PushyDeviceWhereUniqueInput
  }

  export type PushyDeviceUpdateOneRequiredWithoutSubscriptionsNestedInput = {
    create?: XOR<PushyDeviceCreateWithoutSubscriptionsInput, PushyDeviceUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: PushyDeviceCreateOrConnectWithoutSubscriptionsInput
    upsert?: PushyDeviceUpsertWithoutSubscriptionsInput
    connect?: PushyDeviceWhereUniqueInput
    update?: XOR<XOR<PushyDeviceUpdateToOneWithWhereWithoutSubscriptionsInput, PushyDeviceUpdateWithoutSubscriptionsInput>, PushyDeviceUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type PushyDeviceCreateNestedOneWithoutAllocationInput = {
    create?: XOR<PushyDeviceCreateWithoutAllocationInput, PushyDeviceUncheckedCreateWithoutAllocationInput>
    connectOrCreate?: PushyDeviceCreateOrConnectWithoutAllocationInput
    connect?: PushyDeviceWhereUniqueInput
  }

  export type TenantCreateNestedOneWithoutDeviceAllocationsInput = {
    create?: XOR<TenantCreateWithoutDeviceAllocationsInput, TenantUncheckedCreateWithoutDeviceAllocationsInput>
    connectOrCreate?: TenantCreateOrConnectWithoutDeviceAllocationsInput
    connect?: TenantWhereUniqueInput
  }

  export type TenantSubscriptionCreateNestedOneWithoutDeviceAllocationsInput = {
    create?: XOR<TenantSubscriptionCreateWithoutDeviceAllocationsInput, TenantSubscriptionUncheckedCreateWithoutDeviceAllocationsInput>
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutDeviceAllocationsInput
    connect?: TenantSubscriptionWhereUniqueInput
  }

  export type PushyDeviceUpdateOneRequiredWithoutAllocationNestedInput = {
    create?: XOR<PushyDeviceCreateWithoutAllocationInput, PushyDeviceUncheckedCreateWithoutAllocationInput>
    connectOrCreate?: PushyDeviceCreateOrConnectWithoutAllocationInput
    upsert?: PushyDeviceUpsertWithoutAllocationInput
    connect?: PushyDeviceWhereUniqueInput
    update?: XOR<XOR<PushyDeviceUpdateToOneWithWhereWithoutAllocationInput, PushyDeviceUpdateWithoutAllocationInput>, PushyDeviceUncheckedUpdateWithoutAllocationInput>
  }

  export type TenantUpdateOneRequiredWithoutDeviceAllocationsNestedInput = {
    create?: XOR<TenantCreateWithoutDeviceAllocationsInput, TenantUncheckedCreateWithoutDeviceAllocationsInput>
    connectOrCreate?: TenantCreateOrConnectWithoutDeviceAllocationsInput
    upsert?: TenantUpsertWithoutDeviceAllocationsInput
    connect?: TenantWhereUniqueInput
    update?: XOR<XOR<TenantUpdateToOneWithWhereWithoutDeviceAllocationsInput, TenantUpdateWithoutDeviceAllocationsInput>, TenantUncheckedUpdateWithoutDeviceAllocationsInput>
  }

  export type TenantSubscriptionUpdateOneWithoutDeviceAllocationsNestedInput = {
    create?: XOR<TenantSubscriptionCreateWithoutDeviceAllocationsInput, TenantSubscriptionUncheckedCreateWithoutDeviceAllocationsInput>
    connectOrCreate?: TenantSubscriptionCreateOrConnectWithoutDeviceAllocationsInput
    upsert?: TenantSubscriptionUpsertWithoutDeviceAllocationsInput
    disconnect?: TenantSubscriptionWhereInput | boolean
    delete?: TenantSubscriptionWhereInput | boolean
    connect?: TenantSubscriptionWhereUniqueInput
    update?: XOR<XOR<TenantSubscriptionUpdateToOneWithWhereWithoutDeviceAllocationsInput, TenantSubscriptionUpdateWithoutDeviceAllocationsInput>, TenantSubscriptionUncheckedUpdateWithoutDeviceAllocationsInput>
  }

  export type TenantCreateNestedOneWithoutWarehousesInput = {
    create?: XOR<TenantCreateWithoutWarehousesInput, TenantUncheckedCreateWithoutWarehousesInput>
    connectOrCreate?: TenantCreateOrConnectWithoutWarehousesInput
    connect?: TenantWhereUniqueInput
  }

  export type TenantUpdateOneRequiredWithoutWarehousesNestedInput = {
    create?: XOR<TenantCreateWithoutWarehousesInput, TenantUncheckedCreateWithoutWarehousesInput>
    connectOrCreate?: TenantCreateOrConnectWithoutWarehousesInput
    upsert?: TenantUpsertWithoutWarehousesInput
    connect?: TenantWhereUniqueInput
    update?: XOR<XOR<TenantUpdateToOneWithWhereWithoutWarehousesInput, TenantUpdateWithoutWarehousesInput>, TenantUncheckedUpdateWithoutWarehousesInput>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    search?: string
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    search?: string
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    search?: string
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    search?: string
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type TenantSubscriptionCreateWithoutSubscriptionPlanInput = {
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    outlet: TenantOutletCreateNestedOneWithoutSubscriptionsInput
    discount?: DiscountCreateNestedOneWithoutSubscriptionsInput
    tenant: TenantCreateNestedOneWithoutSubscriptionInput
    subscriptionAddOn?: TenantSubscriptionAddOnCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput = {
    id?: number
    tenantId: number
    outletId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionCreateOrConnectWithoutSubscriptionPlanInput = {
    where: TenantSubscriptionWhereUniqueInput
    create: XOR<TenantSubscriptionCreateWithoutSubscriptionPlanInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput>
  }

  export type TenantSubscriptionCreateManySubscriptionPlanInputEnvelope = {
    data: TenantSubscriptionCreateManySubscriptionPlanInput | TenantSubscriptionCreateManySubscriptionPlanInput[]
    skipDuplicates?: boolean
  }

  export type TenantSubscriptionUpsertWithWhereUniqueWithoutSubscriptionPlanInput = {
    where: TenantSubscriptionWhereUniqueInput
    update: XOR<TenantSubscriptionUpdateWithoutSubscriptionPlanInput, TenantSubscriptionUncheckedUpdateWithoutSubscriptionPlanInput>
    create: XOR<TenantSubscriptionCreateWithoutSubscriptionPlanInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionPlanInput>
  }

  export type TenantSubscriptionUpdateWithWhereUniqueWithoutSubscriptionPlanInput = {
    where: TenantSubscriptionWhereUniqueInput
    data: XOR<TenantSubscriptionUpdateWithoutSubscriptionPlanInput, TenantSubscriptionUncheckedUpdateWithoutSubscriptionPlanInput>
  }

  export type TenantSubscriptionUpdateManyWithWhereWithoutSubscriptionPlanInput = {
    where: TenantSubscriptionScalarWhereInput
    data: XOR<TenantSubscriptionUpdateManyMutationInput, TenantSubscriptionUncheckedUpdateManyWithoutSubscriptionPlanInput>
  }

  export type TenantSubscriptionScalarWhereInput = {
    AND?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
    OR?: TenantSubscriptionScalarWhereInput[]
    NOT?: TenantSubscriptionScalarWhereInput | TenantSubscriptionScalarWhereInput[]
    id?: IntFilter<"TenantSubscription"> | number
    tenantId?: IntFilter<"TenantSubscription"> | number
    outletId?: IntFilter<"TenantSubscription"> | number
    subscriptionPlanId?: IntFilter<"TenantSubscription"> | number
    status?: StringFilter<"TenantSubscription"> | string
    nextPaymentDate?: DateTimeFilter<"TenantSubscription"> | Date | string
    subscriptionValidUntil?: DateTimeFilter<"TenantSubscription"> | Date | string
    createdAt?: DateTimeFilter<"TenantSubscription"> | Date | string
    updatedAt?: DateTimeFilter<"TenantSubscription"> | Date | string
    discountId?: IntNullableFilter<"TenantSubscription"> | number | null
  }

  export type TenantSubscriptionAddOnCreateWithoutAddOnInput = {
    quantity?: number
    tenantSubscription: TenantSubscriptionCreateNestedOneWithoutSubscriptionAddOnInput
  }

  export type TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput = {
    id?: number
    tenantSubscriptionId: number
    quantity?: number
  }

  export type TenantSubscriptionAddOnCreateOrConnectWithoutAddOnInput = {
    where: TenantSubscriptionAddOnWhereUniqueInput
    create: XOR<TenantSubscriptionAddOnCreateWithoutAddOnInput, TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput>
  }

  export type TenantSubscriptionAddOnCreateManyAddOnInputEnvelope = {
    data: TenantSubscriptionAddOnCreateManyAddOnInput | TenantSubscriptionAddOnCreateManyAddOnInput[]
    skipDuplicates?: boolean
  }

  export type TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutAddOnInput = {
    where: TenantSubscriptionAddOnWhereUniqueInput
    update: XOR<TenantSubscriptionAddOnUpdateWithoutAddOnInput, TenantSubscriptionAddOnUncheckedUpdateWithoutAddOnInput>
    create: XOR<TenantSubscriptionAddOnCreateWithoutAddOnInput, TenantSubscriptionAddOnUncheckedCreateWithoutAddOnInput>
  }

  export type TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutAddOnInput = {
    where: TenantSubscriptionAddOnWhereUniqueInput
    data: XOR<TenantSubscriptionAddOnUpdateWithoutAddOnInput, TenantSubscriptionAddOnUncheckedUpdateWithoutAddOnInput>
  }

  export type TenantSubscriptionAddOnUpdateManyWithWhereWithoutAddOnInput = {
    where: TenantSubscriptionAddOnScalarWhereInput
    data: XOR<TenantSubscriptionAddOnUpdateManyMutationInput, TenantSubscriptionAddOnUncheckedUpdateManyWithoutAddOnInput>
  }

  export type TenantSubscriptionAddOnScalarWhereInput = {
    AND?: TenantSubscriptionAddOnScalarWhereInput | TenantSubscriptionAddOnScalarWhereInput[]
    OR?: TenantSubscriptionAddOnScalarWhereInput[]
    NOT?: TenantSubscriptionAddOnScalarWhereInput | TenantSubscriptionAddOnScalarWhereInput[]
    id?: IntFilter<"TenantSubscriptionAddOn"> | number
    tenantSubscriptionId?: IntFilter<"TenantSubscriptionAddOn"> | number
    addOnId?: IntFilter<"TenantSubscriptionAddOn"> | number
    quantity?: IntFilter<"TenantSubscriptionAddOn"> | number
  }

  export type TenantUserCreateWithoutTenantInput = {
    username: string
    password?: string | null
    role?: string
    isDeleted?: boolean
    pushyDevices?: PushyDeviceCreateNestedManyWithoutTenantUserInput
  }

  export type TenantUserUncheckedCreateWithoutTenantInput = {
    id?: number
    username: string
    password?: string | null
    role?: string
    isDeleted?: boolean
    pushyDevices?: PushyDeviceUncheckedCreateNestedManyWithoutTenantUserInput
  }

  export type TenantUserCreateOrConnectWithoutTenantInput = {
    where: TenantUserWhereUniqueInput
    create: XOR<TenantUserCreateWithoutTenantInput, TenantUserUncheckedCreateWithoutTenantInput>
  }

  export type TenantUserCreateManyTenantInputEnvelope = {
    data: TenantUserCreateManyTenantInput | TenantUserCreateManyTenantInput[]
    skipDuplicates?: boolean
  }

  export type TenantSubscriptionCreateWithoutTenantInput = {
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    outlet: TenantOutletCreateNestedOneWithoutSubscriptionsInput
    discount?: DiscountCreateNestedOneWithoutSubscriptionsInput
    subscriptionPlan: SubscriptionPlanCreateNestedOneWithoutSubscriptionInput
    subscriptionAddOn?: TenantSubscriptionAddOnCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionUncheckedCreateWithoutTenantInput = {
    id?: number
    outletId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionCreateOrConnectWithoutTenantInput = {
    where: TenantSubscriptionWhereUniqueInput
    create: XOR<TenantSubscriptionCreateWithoutTenantInput, TenantSubscriptionUncheckedCreateWithoutTenantInput>
  }

  export type TenantSubscriptionCreateManyTenantInputEnvelope = {
    data: TenantSubscriptionCreateManyTenantInput | TenantSubscriptionCreateManyTenantInput[]
    skipDuplicates?: boolean
  }

  export type TenantOutletCreateWithoutTenantInput = {
    outletName: string
    address?: string | null
    createdAt?: Date | string
    isActive?: boolean
    subscriptions?: TenantSubscriptionCreateNestedManyWithoutOutletInput
  }

  export type TenantOutletUncheckedCreateWithoutTenantInput = {
    id?: number
    outletName: string
    address?: string | null
    createdAt?: Date | string
    isActive?: boolean
    subscriptions?: TenantSubscriptionUncheckedCreateNestedManyWithoutOutletInput
  }

  export type TenantOutletCreateOrConnectWithoutTenantInput = {
    where: TenantOutletWhereUniqueInput
    create: XOR<TenantOutletCreateWithoutTenantInput, TenantOutletUncheckedCreateWithoutTenantInput>
  }

  export type TenantOutletCreateManyTenantInputEnvelope = {
    data: TenantOutletCreateManyTenantInput | TenantOutletCreateManyTenantInput[]
    skipDuplicates?: boolean
  }

  export type PushyDeviceAllocationCreateWithoutTenantInput = {
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
    device: PushyDeviceCreateNestedOneWithoutAllocationInput
    subscription?: TenantSubscriptionCreateNestedOneWithoutDeviceAllocationsInput
  }

  export type PushyDeviceAllocationUncheckedCreateWithoutTenantInput = {
    id?: number
    deviceId: number
    subscriptionId?: number | null
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
  }

  export type PushyDeviceAllocationCreateOrConnectWithoutTenantInput = {
    where: PushyDeviceAllocationWhereUniqueInput
    create: XOR<PushyDeviceAllocationCreateWithoutTenantInput, PushyDeviceAllocationUncheckedCreateWithoutTenantInput>
  }

  export type PushyDeviceAllocationCreateManyTenantInputEnvelope = {
    data: PushyDeviceAllocationCreateManyTenantInput | PushyDeviceAllocationCreateManyTenantInput[]
    skipDuplicates?: boolean
  }

  export type TenantWarehouseCreateWithoutTenantInput = {
    warehouseName: string
    warehouseCode: string
    address?: string | null
    isActive?: boolean
    deleted?: boolean
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TenantWarehouseUncheckedCreateWithoutTenantInput = {
    id?: number
    warehouseName: string
    warehouseCode: string
    address?: string | null
    isActive?: boolean
    deleted?: boolean
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TenantWarehouseCreateOrConnectWithoutTenantInput = {
    where: TenantWarehouseWhereUniqueInput
    create: XOR<TenantWarehouseCreateWithoutTenantInput, TenantWarehouseUncheckedCreateWithoutTenantInput>
  }

  export type TenantWarehouseCreateManyTenantInputEnvelope = {
    data: TenantWarehouseCreateManyTenantInput | TenantWarehouseCreateManyTenantInput[]
    skipDuplicates?: boolean
  }

  export type TenantUserUpsertWithWhereUniqueWithoutTenantInput = {
    where: TenantUserWhereUniqueInput
    update: XOR<TenantUserUpdateWithoutTenantInput, TenantUserUncheckedUpdateWithoutTenantInput>
    create: XOR<TenantUserCreateWithoutTenantInput, TenantUserUncheckedCreateWithoutTenantInput>
  }

  export type TenantUserUpdateWithWhereUniqueWithoutTenantInput = {
    where: TenantUserWhereUniqueInput
    data: XOR<TenantUserUpdateWithoutTenantInput, TenantUserUncheckedUpdateWithoutTenantInput>
  }

  export type TenantUserUpdateManyWithWhereWithoutTenantInput = {
    where: TenantUserScalarWhereInput
    data: XOR<TenantUserUpdateManyMutationInput, TenantUserUncheckedUpdateManyWithoutTenantInput>
  }

  export type TenantUserScalarWhereInput = {
    AND?: TenantUserScalarWhereInput | TenantUserScalarWhereInput[]
    OR?: TenantUserScalarWhereInput[]
    NOT?: TenantUserScalarWhereInput | TenantUserScalarWhereInput[]
    id?: IntFilter<"TenantUser"> | number
    username?: StringFilter<"TenantUser"> | string
    password?: StringNullableFilter<"TenantUser"> | string | null
    tenantId?: IntFilter<"TenantUser"> | number
    role?: StringFilter<"TenantUser"> | string
    isDeleted?: BoolFilter<"TenantUser"> | boolean
  }

  export type TenantSubscriptionUpsertWithWhereUniqueWithoutTenantInput = {
    where: TenantSubscriptionWhereUniqueInput
    update: XOR<TenantSubscriptionUpdateWithoutTenantInput, TenantSubscriptionUncheckedUpdateWithoutTenantInput>
    create: XOR<TenantSubscriptionCreateWithoutTenantInput, TenantSubscriptionUncheckedCreateWithoutTenantInput>
  }

  export type TenantSubscriptionUpdateWithWhereUniqueWithoutTenantInput = {
    where: TenantSubscriptionWhereUniqueInput
    data: XOR<TenantSubscriptionUpdateWithoutTenantInput, TenantSubscriptionUncheckedUpdateWithoutTenantInput>
  }

  export type TenantSubscriptionUpdateManyWithWhereWithoutTenantInput = {
    where: TenantSubscriptionScalarWhereInput
    data: XOR<TenantSubscriptionUpdateManyMutationInput, TenantSubscriptionUncheckedUpdateManyWithoutTenantInput>
  }

  export type TenantOutletUpsertWithWhereUniqueWithoutTenantInput = {
    where: TenantOutletWhereUniqueInput
    update: XOR<TenantOutletUpdateWithoutTenantInput, TenantOutletUncheckedUpdateWithoutTenantInput>
    create: XOR<TenantOutletCreateWithoutTenantInput, TenantOutletUncheckedCreateWithoutTenantInput>
  }

  export type TenantOutletUpdateWithWhereUniqueWithoutTenantInput = {
    where: TenantOutletWhereUniqueInput
    data: XOR<TenantOutletUpdateWithoutTenantInput, TenantOutletUncheckedUpdateWithoutTenantInput>
  }

  export type TenantOutletUpdateManyWithWhereWithoutTenantInput = {
    where: TenantOutletScalarWhereInput
    data: XOR<TenantOutletUpdateManyMutationInput, TenantOutletUncheckedUpdateManyWithoutTenantInput>
  }

  export type TenantOutletScalarWhereInput = {
    AND?: TenantOutletScalarWhereInput | TenantOutletScalarWhereInput[]
    OR?: TenantOutletScalarWhereInput[]
    NOT?: TenantOutletScalarWhereInput | TenantOutletScalarWhereInput[]
    id?: IntFilter<"TenantOutlet"> | number
    tenantId?: IntFilter<"TenantOutlet"> | number
    outletName?: StringFilter<"TenantOutlet"> | string
    address?: StringNullableFilter<"TenantOutlet"> | string | null
    createdAt?: DateTimeFilter<"TenantOutlet"> | Date | string
    isActive?: BoolFilter<"TenantOutlet"> | boolean
  }

  export type PushyDeviceAllocationUpsertWithWhereUniqueWithoutTenantInput = {
    where: PushyDeviceAllocationWhereUniqueInput
    update: XOR<PushyDeviceAllocationUpdateWithoutTenantInput, PushyDeviceAllocationUncheckedUpdateWithoutTenantInput>
    create: XOR<PushyDeviceAllocationCreateWithoutTenantInput, PushyDeviceAllocationUncheckedCreateWithoutTenantInput>
  }

  export type PushyDeviceAllocationUpdateWithWhereUniqueWithoutTenantInput = {
    where: PushyDeviceAllocationWhereUniqueInput
    data: XOR<PushyDeviceAllocationUpdateWithoutTenantInput, PushyDeviceAllocationUncheckedUpdateWithoutTenantInput>
  }

  export type PushyDeviceAllocationUpdateManyWithWhereWithoutTenantInput = {
    where: PushyDeviceAllocationScalarWhereInput
    data: XOR<PushyDeviceAllocationUpdateManyMutationInput, PushyDeviceAllocationUncheckedUpdateManyWithoutTenantInput>
  }

  export type PushyDeviceAllocationScalarWhereInput = {
    AND?: PushyDeviceAllocationScalarWhereInput | PushyDeviceAllocationScalarWhereInput[]
    OR?: PushyDeviceAllocationScalarWhereInput[]
    NOT?: PushyDeviceAllocationScalarWhereInput | PushyDeviceAllocationScalarWhereInput[]
    id?: IntFilter<"PushyDeviceAllocation"> | number
    deviceId?: IntFilter<"PushyDeviceAllocation"> | number
    tenantId?: IntFilter<"PushyDeviceAllocation"> | number
    subscriptionId?: IntNullableFilter<"PushyDeviceAllocation"> | number | null
    addOnId?: IntNullableFilter<"PushyDeviceAllocation"> | number | null
    allocationType?: StringFilter<"PushyDeviceAllocation"> | string
    activatedAt?: DateTimeFilter<"PushyDeviceAllocation"> | Date | string
    expiresAt?: DateTimeNullableFilter<"PushyDeviceAllocation"> | Date | string | null
    createdAt?: DateTimeFilter<"PushyDeviceAllocation"> | Date | string
  }

  export type TenantWarehouseUpsertWithWhereUniqueWithoutTenantInput = {
    where: TenantWarehouseWhereUniqueInput
    update: XOR<TenantWarehouseUpdateWithoutTenantInput, TenantWarehouseUncheckedUpdateWithoutTenantInput>
    create: XOR<TenantWarehouseCreateWithoutTenantInput, TenantWarehouseUncheckedCreateWithoutTenantInput>
  }

  export type TenantWarehouseUpdateWithWhereUniqueWithoutTenantInput = {
    where: TenantWarehouseWhereUniqueInput
    data: XOR<TenantWarehouseUpdateWithoutTenantInput, TenantWarehouseUncheckedUpdateWithoutTenantInput>
  }

  export type TenantWarehouseUpdateManyWithWhereWithoutTenantInput = {
    where: TenantWarehouseScalarWhereInput
    data: XOR<TenantWarehouseUpdateManyMutationInput, TenantWarehouseUncheckedUpdateManyWithoutTenantInput>
  }

  export type TenantWarehouseScalarWhereInput = {
    AND?: TenantWarehouseScalarWhereInput | TenantWarehouseScalarWhereInput[]
    OR?: TenantWarehouseScalarWhereInput[]
    NOT?: TenantWarehouseScalarWhereInput | TenantWarehouseScalarWhereInput[]
    id?: IntFilter<"TenantWarehouse"> | number
    tenantId?: IntFilter<"TenantWarehouse"> | number
    warehouseName?: StringFilter<"TenantWarehouse"> | string
    warehouseCode?: StringFilter<"TenantWarehouse"> | string
    address?: StringNullableFilter<"TenantWarehouse"> | string | null
    isActive?: BoolFilter<"TenantWarehouse"> | boolean
    deleted?: BoolFilter<"TenantWarehouse"> | boolean
    deletedAt?: DateTimeNullableFilter<"TenantWarehouse"> | Date | string | null
    createdAt?: DateTimeFilter<"TenantWarehouse"> | Date | string
    updatedAt?: DateTimeFilter<"TenantWarehouse"> | Date | string
  }

  export type TenantOutletCreateWithoutSubscriptionsInput = {
    outletName: string
    address?: string | null
    createdAt?: Date | string
    isActive?: boolean
    tenant: TenantCreateNestedOneWithoutTenantOutletsInput
  }

  export type TenantOutletUncheckedCreateWithoutSubscriptionsInput = {
    id?: number
    tenantId: number
    outletName: string
    address?: string | null
    createdAt?: Date | string
    isActive?: boolean
  }

  export type TenantOutletCreateOrConnectWithoutSubscriptionsInput = {
    where: TenantOutletWhereUniqueInput
    create: XOR<TenantOutletCreateWithoutSubscriptionsInput, TenantOutletUncheckedCreateWithoutSubscriptionsInput>
  }

  export type DiscountCreateWithoutSubscriptionsInput = {
    name: string
    discountType: string
    value: number
    startDate?: Date | string
    endDate?: Date | string | null
    maxUses?: number | null
    appliesTo: string
    createdAt?: Date | string
  }

  export type DiscountUncheckedCreateWithoutSubscriptionsInput = {
    id?: number
    name: string
    discountType: string
    value: number
    startDate?: Date | string
    endDate?: Date | string | null
    maxUses?: number | null
    appliesTo: string
    createdAt?: Date | string
  }

  export type DiscountCreateOrConnectWithoutSubscriptionsInput = {
    where: DiscountWhereUniqueInput
    create: XOR<DiscountCreateWithoutSubscriptionsInput, DiscountUncheckedCreateWithoutSubscriptionsInput>
  }

  export type TenantCreateWithoutSubscriptionInput = {
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseCreateNestedManyWithoutTenantInput
  }

  export type TenantUncheckedCreateWithoutSubscriptionInput = {
    id?: number
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserUncheckedCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletUncheckedCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseUncheckedCreateNestedManyWithoutTenantInput
  }

  export type TenantCreateOrConnectWithoutSubscriptionInput = {
    where: TenantWhereUniqueInput
    create: XOR<TenantCreateWithoutSubscriptionInput, TenantUncheckedCreateWithoutSubscriptionInput>
  }

  export type SubscriptionPlanCreateWithoutSubscriptionInput = {
    planName: string
    planType?: string
    price: number
    maxTransactions?: number | null
    maxProducts?: number | null
    maxUsers?: number | null
    maxDevices?: number | null
    description?: string | null
  }

  export type SubscriptionPlanUncheckedCreateWithoutSubscriptionInput = {
    id?: number
    planName: string
    planType?: string
    price: number
    maxTransactions?: number | null
    maxProducts?: number | null
    maxUsers?: number | null
    maxDevices?: number | null
    description?: string | null
  }

  export type SubscriptionPlanCreateOrConnectWithoutSubscriptionInput = {
    where: SubscriptionPlanWhereUniqueInput
    create: XOR<SubscriptionPlanCreateWithoutSubscriptionInput, SubscriptionPlanUncheckedCreateWithoutSubscriptionInput>
  }

  export type TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput = {
    quantity?: number
    addOn: SubscriptionAddOnCreateNestedOneWithoutSubscriptionsInput
  }

  export type TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput = {
    id?: number
    addOnId: number
    quantity?: number
  }

  export type TenantSubscriptionAddOnCreateOrConnectWithoutTenantSubscriptionInput = {
    where: TenantSubscriptionAddOnWhereUniqueInput
    create: XOR<TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput, TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput>
  }

  export type TenantSubscriptionAddOnCreateManyTenantSubscriptionInputEnvelope = {
    data: TenantSubscriptionAddOnCreateManyTenantSubscriptionInput | TenantSubscriptionAddOnCreateManyTenantSubscriptionInput[]
    skipDuplicates?: boolean
  }

  export type PushyDeviceAllocationCreateWithoutSubscriptionInput = {
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
    device: PushyDeviceCreateNestedOneWithoutAllocationInput
    tenant: TenantCreateNestedOneWithoutDeviceAllocationsInput
  }

  export type PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput = {
    id?: number
    deviceId: number
    tenantId: number
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
  }

  export type PushyDeviceAllocationCreateOrConnectWithoutSubscriptionInput = {
    where: PushyDeviceAllocationWhereUniqueInput
    create: XOR<PushyDeviceAllocationCreateWithoutSubscriptionInput, PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput>
  }

  export type PushyDeviceAllocationCreateManySubscriptionInputEnvelope = {
    data: PushyDeviceAllocationCreateManySubscriptionInput | PushyDeviceAllocationCreateManySubscriptionInput[]
    skipDuplicates?: boolean
  }

  export type TenantOutletUpsertWithoutSubscriptionsInput = {
    update: XOR<TenantOutletUpdateWithoutSubscriptionsInput, TenantOutletUncheckedUpdateWithoutSubscriptionsInput>
    create: XOR<TenantOutletCreateWithoutSubscriptionsInput, TenantOutletUncheckedCreateWithoutSubscriptionsInput>
    where?: TenantOutletWhereInput
  }

  export type TenantOutletUpdateToOneWithWhereWithoutSubscriptionsInput = {
    where?: TenantOutletWhereInput
    data: XOR<TenantOutletUpdateWithoutSubscriptionsInput, TenantOutletUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type TenantOutletUpdateWithoutSubscriptionsInput = {
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    tenant?: TenantUpdateOneRequiredWithoutTenantOutletsNestedInput
  }

  export type TenantOutletUncheckedUpdateWithoutSubscriptionsInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type DiscountUpsertWithoutSubscriptionsInput = {
    update: XOR<DiscountUpdateWithoutSubscriptionsInput, DiscountUncheckedUpdateWithoutSubscriptionsInput>
    create: XOR<DiscountCreateWithoutSubscriptionsInput, DiscountUncheckedCreateWithoutSubscriptionsInput>
    where?: DiscountWhereInput
  }

  export type DiscountUpdateToOneWithWhereWithoutSubscriptionsInput = {
    where?: DiscountWhereInput
    data: XOR<DiscountUpdateWithoutSubscriptionsInput, DiscountUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type DiscountUpdateWithoutSubscriptionsInput = {
    name?: StringFieldUpdateOperationsInput | string
    discountType?: StringFieldUpdateOperationsInput | string
    value?: FloatFieldUpdateOperationsInput | number
    startDate?: DateTimeFieldUpdateOperationsInput | Date | string
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maxUses?: NullableIntFieldUpdateOperationsInput | number | null
    appliesTo?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DiscountUncheckedUpdateWithoutSubscriptionsInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    discountType?: StringFieldUpdateOperationsInput | string
    value?: FloatFieldUpdateOperationsInput | number
    startDate?: DateTimeFieldUpdateOperationsInput | Date | string
    endDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maxUses?: NullableIntFieldUpdateOperationsInput | number | null
    appliesTo?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantUpsertWithoutSubscriptionInput = {
    update: XOR<TenantUpdateWithoutSubscriptionInput, TenantUncheckedUpdateWithoutSubscriptionInput>
    create: XOR<TenantCreateWithoutSubscriptionInput, TenantUncheckedCreateWithoutSubscriptionInput>
    where?: TenantWhereInput
  }

  export type TenantUpdateToOneWithWhereWithoutSubscriptionInput = {
    where?: TenantWhereInput
    data: XOR<TenantUpdateWithoutSubscriptionInput, TenantUncheckedUpdateWithoutSubscriptionInput>
  }

  export type TenantUpdateWithoutSubscriptionInput = {
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUpdateManyWithoutTenantNestedInput
  }

  export type TenantUncheckedUpdateWithoutSubscriptionInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUncheckedUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUncheckedUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUncheckedUpdateManyWithoutTenantNestedInput
  }

  export type SubscriptionPlanUpsertWithoutSubscriptionInput = {
    update: XOR<SubscriptionPlanUpdateWithoutSubscriptionInput, SubscriptionPlanUncheckedUpdateWithoutSubscriptionInput>
    create: XOR<SubscriptionPlanCreateWithoutSubscriptionInput, SubscriptionPlanUncheckedCreateWithoutSubscriptionInput>
    where?: SubscriptionPlanWhereInput
  }

  export type SubscriptionPlanUpdateToOneWithWhereWithoutSubscriptionInput = {
    where?: SubscriptionPlanWhereInput
    data: XOR<SubscriptionPlanUpdateWithoutSubscriptionInput, SubscriptionPlanUncheckedUpdateWithoutSubscriptionInput>
  }

  export type SubscriptionPlanUpdateWithoutSubscriptionInput = {
    planName?: StringFieldUpdateOperationsInput | string
    planType?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    maxTransactions?: NullableIntFieldUpdateOperationsInput | number | null
    maxProducts?: NullableIntFieldUpdateOperationsInput | number | null
    maxUsers?: NullableIntFieldUpdateOperationsInput | number | null
    maxDevices?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SubscriptionPlanUncheckedUpdateWithoutSubscriptionInput = {
    id?: IntFieldUpdateOperationsInput | number
    planName?: StringFieldUpdateOperationsInput | string
    planType?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    maxTransactions?: NullableIntFieldUpdateOperationsInput | number | null
    maxProducts?: NullableIntFieldUpdateOperationsInput | number | null
    maxUsers?: NullableIntFieldUpdateOperationsInput | number | null
    maxDevices?: NullableIntFieldUpdateOperationsInput | number | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TenantSubscriptionAddOnUpsertWithWhereUniqueWithoutTenantSubscriptionInput = {
    where: TenantSubscriptionAddOnWhereUniqueInput
    update: XOR<TenantSubscriptionAddOnUpdateWithoutTenantSubscriptionInput, TenantSubscriptionAddOnUncheckedUpdateWithoutTenantSubscriptionInput>
    create: XOR<TenantSubscriptionAddOnCreateWithoutTenantSubscriptionInput, TenantSubscriptionAddOnUncheckedCreateWithoutTenantSubscriptionInput>
  }

  export type TenantSubscriptionAddOnUpdateWithWhereUniqueWithoutTenantSubscriptionInput = {
    where: TenantSubscriptionAddOnWhereUniqueInput
    data: XOR<TenantSubscriptionAddOnUpdateWithoutTenantSubscriptionInput, TenantSubscriptionAddOnUncheckedUpdateWithoutTenantSubscriptionInput>
  }

  export type TenantSubscriptionAddOnUpdateManyWithWhereWithoutTenantSubscriptionInput = {
    where: TenantSubscriptionAddOnScalarWhereInput
    data: XOR<TenantSubscriptionAddOnUpdateManyMutationInput, TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionInput>
  }

  export type PushyDeviceAllocationUpsertWithWhereUniqueWithoutSubscriptionInput = {
    where: PushyDeviceAllocationWhereUniqueInput
    update: XOR<PushyDeviceAllocationUpdateWithoutSubscriptionInput, PushyDeviceAllocationUncheckedUpdateWithoutSubscriptionInput>
    create: XOR<PushyDeviceAllocationCreateWithoutSubscriptionInput, PushyDeviceAllocationUncheckedCreateWithoutSubscriptionInput>
  }

  export type PushyDeviceAllocationUpdateWithWhereUniqueWithoutSubscriptionInput = {
    where: PushyDeviceAllocationWhereUniqueInput
    data: XOR<PushyDeviceAllocationUpdateWithoutSubscriptionInput, PushyDeviceAllocationUncheckedUpdateWithoutSubscriptionInput>
  }

  export type PushyDeviceAllocationUpdateManyWithWhereWithoutSubscriptionInput = {
    where: PushyDeviceAllocationScalarWhereInput
    data: XOR<PushyDeviceAllocationUpdateManyMutationInput, PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionInput>
  }

  export type TenantSubscriptionCreateWithoutSubscriptionAddOnInput = {
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    outlet: TenantOutletCreateNestedOneWithoutSubscriptionsInput
    discount?: DiscountCreateNestedOneWithoutSubscriptionsInput
    tenant: TenantCreateNestedOneWithoutSubscriptionInput
    subscriptionPlan: SubscriptionPlanCreateNestedOneWithoutSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionUncheckedCreateWithoutSubscriptionAddOnInput = {
    id?: number
    tenantId: number
    outletId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionCreateOrConnectWithoutSubscriptionAddOnInput = {
    where: TenantSubscriptionWhereUniqueInput
    create: XOR<TenantSubscriptionCreateWithoutSubscriptionAddOnInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionAddOnInput>
  }

  export type SubscriptionAddOnCreateWithoutSubscriptionsInput = {
    name: string
    addOnType: string
    pricePerUnit: number
    maxQuantity?: number | null
    scope?: string
    description?: string | null
  }

  export type SubscriptionAddOnUncheckedCreateWithoutSubscriptionsInput = {
    id?: number
    name: string
    addOnType: string
    pricePerUnit: number
    maxQuantity?: number | null
    scope?: string
    description?: string | null
  }

  export type SubscriptionAddOnCreateOrConnectWithoutSubscriptionsInput = {
    where: SubscriptionAddOnWhereUniqueInput
    create: XOR<SubscriptionAddOnCreateWithoutSubscriptionsInput, SubscriptionAddOnUncheckedCreateWithoutSubscriptionsInput>
  }

  export type TenantSubscriptionUpsertWithoutSubscriptionAddOnInput = {
    update: XOR<TenantSubscriptionUpdateWithoutSubscriptionAddOnInput, TenantSubscriptionUncheckedUpdateWithoutSubscriptionAddOnInput>
    create: XOR<TenantSubscriptionCreateWithoutSubscriptionAddOnInput, TenantSubscriptionUncheckedCreateWithoutSubscriptionAddOnInput>
    where?: TenantSubscriptionWhereInput
  }

  export type TenantSubscriptionUpdateToOneWithWhereWithoutSubscriptionAddOnInput = {
    where?: TenantSubscriptionWhereInput
    data: XOR<TenantSubscriptionUpdateWithoutSubscriptionAddOnInput, TenantSubscriptionUncheckedUpdateWithoutSubscriptionAddOnInput>
  }

  export type TenantSubscriptionUpdateWithoutSubscriptionAddOnInput = {
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    outlet?: TenantOutletUpdateOneRequiredWithoutSubscriptionsNestedInput
    discount?: DiscountUpdateOneWithoutSubscriptionsNestedInput
    tenant?: TenantUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionPlan?: SubscriptionPlanUpdateOneRequiredWithoutSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateWithoutSubscriptionAddOnInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionNestedInput
  }

  export type SubscriptionAddOnUpsertWithoutSubscriptionsInput = {
    update: XOR<SubscriptionAddOnUpdateWithoutSubscriptionsInput, SubscriptionAddOnUncheckedUpdateWithoutSubscriptionsInput>
    create: XOR<SubscriptionAddOnCreateWithoutSubscriptionsInput, SubscriptionAddOnUncheckedCreateWithoutSubscriptionsInput>
    where?: SubscriptionAddOnWhereInput
  }

  export type SubscriptionAddOnUpdateToOneWithWhereWithoutSubscriptionsInput = {
    where?: SubscriptionAddOnWhereInput
    data: XOR<SubscriptionAddOnUpdateWithoutSubscriptionsInput, SubscriptionAddOnUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type SubscriptionAddOnUpdateWithoutSubscriptionsInput = {
    name?: StringFieldUpdateOperationsInput | string
    addOnType?: StringFieldUpdateOperationsInput | string
    pricePerUnit?: FloatFieldUpdateOperationsInput | number
    maxQuantity?: NullableIntFieldUpdateOperationsInput | number | null
    scope?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SubscriptionAddOnUncheckedUpdateWithoutSubscriptionsInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    addOnType?: StringFieldUpdateOperationsInput | string
    pricePerUnit?: FloatFieldUpdateOperationsInput | number
    maxQuantity?: NullableIntFieldUpdateOperationsInput | number | null
    scope?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TenantCreateWithoutTenantOutletsInput = {
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserCreateNestedManyWithoutTenantInput
    subscription?: TenantSubscriptionCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseCreateNestedManyWithoutTenantInput
  }

  export type TenantUncheckedCreateWithoutTenantOutletsInput = {
    id?: number
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserUncheckedCreateNestedManyWithoutTenantInput
    subscription?: TenantSubscriptionUncheckedCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseUncheckedCreateNestedManyWithoutTenantInput
  }

  export type TenantCreateOrConnectWithoutTenantOutletsInput = {
    where: TenantWhereUniqueInput
    create: XOR<TenantCreateWithoutTenantOutletsInput, TenantUncheckedCreateWithoutTenantOutletsInput>
  }

  export type TenantSubscriptionCreateWithoutOutletInput = {
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discount?: DiscountCreateNestedOneWithoutSubscriptionsInput
    tenant: TenantCreateNestedOneWithoutSubscriptionInput
    subscriptionPlan: SubscriptionPlanCreateNestedOneWithoutSubscriptionInput
    subscriptionAddOn?: TenantSubscriptionAddOnCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionUncheckedCreateWithoutOutletInput = {
    id?: number
    tenantId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionCreateOrConnectWithoutOutletInput = {
    where: TenantSubscriptionWhereUniqueInput
    create: XOR<TenantSubscriptionCreateWithoutOutletInput, TenantSubscriptionUncheckedCreateWithoutOutletInput>
  }

  export type TenantSubscriptionCreateManyOutletInputEnvelope = {
    data: TenantSubscriptionCreateManyOutletInput | TenantSubscriptionCreateManyOutletInput[]
    skipDuplicates?: boolean
  }

  export type TenantUpsertWithoutTenantOutletsInput = {
    update: XOR<TenantUpdateWithoutTenantOutletsInput, TenantUncheckedUpdateWithoutTenantOutletsInput>
    create: XOR<TenantCreateWithoutTenantOutletsInput, TenantUncheckedCreateWithoutTenantOutletsInput>
    where?: TenantWhereInput
  }

  export type TenantUpdateToOneWithWhereWithoutTenantOutletsInput = {
    where?: TenantWhereInput
    data: XOR<TenantUpdateWithoutTenantOutletsInput, TenantUncheckedUpdateWithoutTenantOutletsInput>
  }

  export type TenantUpdateWithoutTenantOutletsInput = {
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUpdateManyWithoutTenantNestedInput
    subscription?: TenantSubscriptionUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUpdateManyWithoutTenantNestedInput
  }

  export type TenantUncheckedUpdateWithoutTenantOutletsInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUncheckedUpdateManyWithoutTenantNestedInput
    subscription?: TenantSubscriptionUncheckedUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUncheckedUpdateManyWithoutTenantNestedInput
  }

  export type TenantSubscriptionUpsertWithWhereUniqueWithoutOutletInput = {
    where: TenantSubscriptionWhereUniqueInput
    update: XOR<TenantSubscriptionUpdateWithoutOutletInput, TenantSubscriptionUncheckedUpdateWithoutOutletInput>
    create: XOR<TenantSubscriptionCreateWithoutOutletInput, TenantSubscriptionUncheckedCreateWithoutOutletInput>
  }

  export type TenantSubscriptionUpdateWithWhereUniqueWithoutOutletInput = {
    where: TenantSubscriptionWhereUniqueInput
    data: XOR<TenantSubscriptionUpdateWithoutOutletInput, TenantSubscriptionUncheckedUpdateWithoutOutletInput>
  }

  export type TenantSubscriptionUpdateManyWithWhereWithoutOutletInput = {
    where: TenantSubscriptionScalarWhereInput
    data: XOR<TenantSubscriptionUpdateManyMutationInput, TenantSubscriptionUncheckedUpdateManyWithoutOutletInput>
  }

  export type TenantSubscriptionCreateWithoutDiscountInput = {
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    outlet: TenantOutletCreateNestedOneWithoutSubscriptionsInput
    tenant: TenantCreateNestedOneWithoutSubscriptionInput
    subscriptionPlan: SubscriptionPlanCreateNestedOneWithoutSubscriptionInput
    subscriptionAddOn?: TenantSubscriptionAddOnCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionUncheckedCreateWithoutDiscountInput = {
    id?: number
    tenantId: number
    outletId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutTenantSubscriptionInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutSubscriptionInput
  }

  export type TenantSubscriptionCreateOrConnectWithoutDiscountInput = {
    where: TenantSubscriptionWhereUniqueInput
    create: XOR<TenantSubscriptionCreateWithoutDiscountInput, TenantSubscriptionUncheckedCreateWithoutDiscountInput>
  }

  export type TenantSubscriptionCreateManyDiscountInputEnvelope = {
    data: TenantSubscriptionCreateManyDiscountInput | TenantSubscriptionCreateManyDiscountInput[]
    skipDuplicates?: boolean
  }

  export type TenantSubscriptionUpsertWithWhereUniqueWithoutDiscountInput = {
    where: TenantSubscriptionWhereUniqueInput
    update: XOR<TenantSubscriptionUpdateWithoutDiscountInput, TenantSubscriptionUncheckedUpdateWithoutDiscountInput>
    create: XOR<TenantSubscriptionCreateWithoutDiscountInput, TenantSubscriptionUncheckedCreateWithoutDiscountInput>
  }

  export type TenantSubscriptionUpdateWithWhereUniqueWithoutDiscountInput = {
    where: TenantSubscriptionWhereUniqueInput
    data: XOR<TenantSubscriptionUpdateWithoutDiscountInput, TenantSubscriptionUncheckedUpdateWithoutDiscountInput>
  }

  export type TenantSubscriptionUpdateManyWithWhereWithoutDiscountInput = {
    where: TenantSubscriptionScalarWhereInput
    data: XOR<TenantSubscriptionUpdateManyMutationInput, TenantSubscriptionUncheckedUpdateManyWithoutDiscountInput>
  }

  export type TenantCreateWithoutTenantUsersInput = {
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    subscription?: TenantSubscriptionCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseCreateNestedManyWithoutTenantInput
  }

  export type TenantUncheckedCreateWithoutTenantUsersInput = {
    id?: number
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    subscription?: TenantSubscriptionUncheckedCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletUncheckedCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseUncheckedCreateNestedManyWithoutTenantInput
  }

  export type TenantCreateOrConnectWithoutTenantUsersInput = {
    where: TenantWhereUniqueInput
    create: XOR<TenantCreateWithoutTenantUsersInput, TenantUncheckedCreateWithoutTenantUsersInput>
  }

  export type PushyDeviceCreateWithoutTenantUserInput = {
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptions?: PushySubscriptionCreateNestedManyWithoutDeviceInput
    allocation?: PushyDeviceAllocationCreateNestedOneWithoutDeviceInput
  }

  export type PushyDeviceUncheckedCreateWithoutTenantUserInput = {
    id?: number
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptions?: PushySubscriptionUncheckedCreateNestedManyWithoutDeviceInput
    allocation?: PushyDeviceAllocationUncheckedCreateNestedOneWithoutDeviceInput
  }

  export type PushyDeviceCreateOrConnectWithoutTenantUserInput = {
    where: PushyDeviceWhereUniqueInput
    create: XOR<PushyDeviceCreateWithoutTenantUserInput, PushyDeviceUncheckedCreateWithoutTenantUserInput>
  }

  export type PushyDeviceCreateManyTenantUserInputEnvelope = {
    data: PushyDeviceCreateManyTenantUserInput | PushyDeviceCreateManyTenantUserInput[]
    skipDuplicates?: boolean
  }

  export type TenantUpsertWithoutTenantUsersInput = {
    update: XOR<TenantUpdateWithoutTenantUsersInput, TenantUncheckedUpdateWithoutTenantUsersInput>
    create: XOR<TenantCreateWithoutTenantUsersInput, TenantUncheckedCreateWithoutTenantUsersInput>
    where?: TenantWhereInput
  }

  export type TenantUpdateToOneWithWhereWithoutTenantUsersInput = {
    where?: TenantWhereInput
    data: XOR<TenantUpdateWithoutTenantUsersInput, TenantUncheckedUpdateWithoutTenantUsersInput>
  }

  export type TenantUpdateWithoutTenantUsersInput = {
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscription?: TenantSubscriptionUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUpdateManyWithoutTenantNestedInput
  }

  export type TenantUncheckedUpdateWithoutTenantUsersInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscription?: TenantSubscriptionUncheckedUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUncheckedUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUncheckedUpdateManyWithoutTenantNestedInput
  }

  export type PushyDeviceUpsertWithWhereUniqueWithoutTenantUserInput = {
    where: PushyDeviceWhereUniqueInput
    update: XOR<PushyDeviceUpdateWithoutTenantUserInput, PushyDeviceUncheckedUpdateWithoutTenantUserInput>
    create: XOR<PushyDeviceCreateWithoutTenantUserInput, PushyDeviceUncheckedCreateWithoutTenantUserInput>
  }

  export type PushyDeviceUpdateWithWhereUniqueWithoutTenantUserInput = {
    where: PushyDeviceWhereUniqueInput
    data: XOR<PushyDeviceUpdateWithoutTenantUserInput, PushyDeviceUncheckedUpdateWithoutTenantUserInput>
  }

  export type PushyDeviceUpdateManyWithWhereWithoutTenantUserInput = {
    where: PushyDeviceScalarWhereInput
    data: XOR<PushyDeviceUpdateManyMutationInput, PushyDeviceUncheckedUpdateManyWithoutTenantUserInput>
  }

  export type PushyDeviceScalarWhereInput = {
    AND?: PushyDeviceScalarWhereInput | PushyDeviceScalarWhereInput[]
    OR?: PushyDeviceScalarWhereInput[]
    NOT?: PushyDeviceScalarWhereInput | PushyDeviceScalarWhereInput[]
    id?: IntFilter<"PushyDevice"> | number
    tenantUserId?: IntFilter<"PushyDevice"> | number
    deviceToken?: StringFilter<"PushyDevice"> | string
    deviceFingerprint?: StringNullableFilter<"PushyDevice"> | string | null
    platform?: StringFilter<"PushyDevice"> | string
    deviceName?: StringNullableFilter<"PushyDevice"> | string | null
    appVersion?: StringNullableFilter<"PushyDevice"> | string | null
    isActive?: BoolFilter<"PushyDevice"> | boolean
    lastActiveAt?: DateTimeNullableFilter<"PushyDevice"> | Date | string | null
    createdAt?: DateTimeFilter<"PushyDevice"> | Date | string
    updatedAt?: DateTimeFilter<"PushyDevice"> | Date | string
  }

  export type TenantUserCreateWithoutPushyDevicesInput = {
    username: string
    password?: string | null
    role?: string
    isDeleted?: boolean
    tenant?: TenantCreateNestedOneWithoutTenantUsersInput
  }

  export type TenantUserUncheckedCreateWithoutPushyDevicesInput = {
    id?: number
    username: string
    password?: string | null
    tenantId: number
    role?: string
    isDeleted?: boolean
  }

  export type TenantUserCreateOrConnectWithoutPushyDevicesInput = {
    where: TenantUserWhereUniqueInput
    create: XOR<TenantUserCreateWithoutPushyDevicesInput, TenantUserUncheckedCreateWithoutPushyDevicesInput>
  }

  export type PushySubscriptionCreateWithoutDeviceInput = {
    topic: string
    subscribedAt?: Date | string
  }

  export type PushySubscriptionUncheckedCreateWithoutDeviceInput = {
    id?: number
    topic: string
    subscribedAt?: Date | string
  }

  export type PushySubscriptionCreateOrConnectWithoutDeviceInput = {
    where: PushySubscriptionWhereUniqueInput
    create: XOR<PushySubscriptionCreateWithoutDeviceInput, PushySubscriptionUncheckedCreateWithoutDeviceInput>
  }

  export type PushySubscriptionCreateManyDeviceInputEnvelope = {
    data: PushySubscriptionCreateManyDeviceInput | PushySubscriptionCreateManyDeviceInput[]
    skipDuplicates?: boolean
  }

  export type PushyDeviceAllocationCreateWithoutDeviceInput = {
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
    tenant: TenantCreateNestedOneWithoutDeviceAllocationsInput
    subscription?: TenantSubscriptionCreateNestedOneWithoutDeviceAllocationsInput
  }

  export type PushyDeviceAllocationUncheckedCreateWithoutDeviceInput = {
    id?: number
    tenantId: number
    subscriptionId?: number | null
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
  }

  export type PushyDeviceAllocationCreateOrConnectWithoutDeviceInput = {
    where: PushyDeviceAllocationWhereUniqueInput
    create: XOR<PushyDeviceAllocationCreateWithoutDeviceInput, PushyDeviceAllocationUncheckedCreateWithoutDeviceInput>
  }

  export type TenantUserUpsertWithoutPushyDevicesInput = {
    update: XOR<TenantUserUpdateWithoutPushyDevicesInput, TenantUserUncheckedUpdateWithoutPushyDevicesInput>
    create: XOR<TenantUserCreateWithoutPushyDevicesInput, TenantUserUncheckedCreateWithoutPushyDevicesInput>
    where?: TenantUserWhereInput
  }

  export type TenantUserUpdateToOneWithWhereWithoutPushyDevicesInput = {
    where?: TenantUserWhereInput
    data: XOR<TenantUserUpdateWithoutPushyDevicesInput, TenantUserUncheckedUpdateWithoutPushyDevicesInput>
  }

  export type TenantUserUpdateWithoutPushyDevicesInput = {
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    tenant?: TenantUpdateOneWithoutTenantUsersNestedInput
  }

  export type TenantUserUncheckedUpdateWithoutPushyDevicesInput = {
    id?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    tenantId?: IntFieldUpdateOperationsInput | number
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PushySubscriptionUpsertWithWhereUniqueWithoutDeviceInput = {
    where: PushySubscriptionWhereUniqueInput
    update: XOR<PushySubscriptionUpdateWithoutDeviceInput, PushySubscriptionUncheckedUpdateWithoutDeviceInput>
    create: XOR<PushySubscriptionCreateWithoutDeviceInput, PushySubscriptionUncheckedCreateWithoutDeviceInput>
  }

  export type PushySubscriptionUpdateWithWhereUniqueWithoutDeviceInput = {
    where: PushySubscriptionWhereUniqueInput
    data: XOR<PushySubscriptionUpdateWithoutDeviceInput, PushySubscriptionUncheckedUpdateWithoutDeviceInput>
  }

  export type PushySubscriptionUpdateManyWithWhereWithoutDeviceInput = {
    where: PushySubscriptionScalarWhereInput
    data: XOR<PushySubscriptionUpdateManyMutationInput, PushySubscriptionUncheckedUpdateManyWithoutDeviceInput>
  }

  export type PushySubscriptionScalarWhereInput = {
    AND?: PushySubscriptionScalarWhereInput | PushySubscriptionScalarWhereInput[]
    OR?: PushySubscriptionScalarWhereInput[]
    NOT?: PushySubscriptionScalarWhereInput | PushySubscriptionScalarWhereInput[]
    id?: IntFilter<"PushySubscription"> | number
    deviceId?: IntFilter<"PushySubscription"> | number
    topic?: StringFilter<"PushySubscription"> | string
    subscribedAt?: DateTimeFilter<"PushySubscription"> | Date | string
  }

  export type PushyDeviceAllocationUpsertWithoutDeviceInput = {
    update: XOR<PushyDeviceAllocationUpdateWithoutDeviceInput, PushyDeviceAllocationUncheckedUpdateWithoutDeviceInput>
    create: XOR<PushyDeviceAllocationCreateWithoutDeviceInput, PushyDeviceAllocationUncheckedCreateWithoutDeviceInput>
    where?: PushyDeviceAllocationWhereInput
  }

  export type PushyDeviceAllocationUpdateToOneWithWhereWithoutDeviceInput = {
    where?: PushyDeviceAllocationWhereInput
    data: XOR<PushyDeviceAllocationUpdateWithoutDeviceInput, PushyDeviceAllocationUncheckedUpdateWithoutDeviceInput>
  }

  export type PushyDeviceAllocationUpdateWithoutDeviceInput = {
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenant?: TenantUpdateOneRequiredWithoutDeviceAllocationsNestedInput
    subscription?: TenantSubscriptionUpdateOneWithoutDeviceAllocationsNestedInput
  }

  export type PushyDeviceAllocationUncheckedUpdateWithoutDeviceInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    subscriptionId?: NullableIntFieldUpdateOperationsInput | number | null
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushyDeviceCreateWithoutSubscriptionsInput = {
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    tenantUser: TenantUserCreateNestedOneWithoutPushyDevicesInput
    allocation?: PushyDeviceAllocationCreateNestedOneWithoutDeviceInput
  }

  export type PushyDeviceUncheckedCreateWithoutSubscriptionsInput = {
    id?: number
    tenantUserId: number
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    allocation?: PushyDeviceAllocationUncheckedCreateNestedOneWithoutDeviceInput
  }

  export type PushyDeviceCreateOrConnectWithoutSubscriptionsInput = {
    where: PushyDeviceWhereUniqueInput
    create: XOR<PushyDeviceCreateWithoutSubscriptionsInput, PushyDeviceUncheckedCreateWithoutSubscriptionsInput>
  }

  export type PushyDeviceUpsertWithoutSubscriptionsInput = {
    update: XOR<PushyDeviceUpdateWithoutSubscriptionsInput, PushyDeviceUncheckedUpdateWithoutSubscriptionsInput>
    create: XOR<PushyDeviceCreateWithoutSubscriptionsInput, PushyDeviceUncheckedCreateWithoutSubscriptionsInput>
    where?: PushyDeviceWhereInput
  }

  export type PushyDeviceUpdateToOneWithWhereWithoutSubscriptionsInput = {
    where?: PushyDeviceWhereInput
    data: XOR<PushyDeviceUpdateWithoutSubscriptionsInput, PushyDeviceUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type PushyDeviceUpdateWithoutSubscriptionsInput = {
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUser?: TenantUserUpdateOneRequiredWithoutPushyDevicesNestedInput
    allocation?: PushyDeviceAllocationUpdateOneWithoutDeviceNestedInput
  }

  export type PushyDeviceUncheckedUpdateWithoutSubscriptionsInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantUserId?: IntFieldUpdateOperationsInput | number
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    allocation?: PushyDeviceAllocationUncheckedUpdateOneWithoutDeviceNestedInput
  }

  export type PushyDeviceCreateWithoutAllocationInput = {
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    tenantUser: TenantUserCreateNestedOneWithoutPushyDevicesInput
    subscriptions?: PushySubscriptionCreateNestedManyWithoutDeviceInput
  }

  export type PushyDeviceUncheckedCreateWithoutAllocationInput = {
    id?: number
    tenantUserId: number
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptions?: PushySubscriptionUncheckedCreateNestedManyWithoutDeviceInput
  }

  export type PushyDeviceCreateOrConnectWithoutAllocationInput = {
    where: PushyDeviceWhereUniqueInput
    create: XOR<PushyDeviceCreateWithoutAllocationInput, PushyDeviceUncheckedCreateWithoutAllocationInput>
  }

  export type TenantCreateWithoutDeviceAllocationsInput = {
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserCreateNestedManyWithoutTenantInput
    subscription?: TenantSubscriptionCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseCreateNestedManyWithoutTenantInput
  }

  export type TenantUncheckedCreateWithoutDeviceAllocationsInput = {
    id?: number
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserUncheckedCreateNestedManyWithoutTenantInput
    subscription?: TenantSubscriptionUncheckedCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletUncheckedCreateNestedManyWithoutTenantInput
    warehouses?: TenantWarehouseUncheckedCreateNestedManyWithoutTenantInput
  }

  export type TenantCreateOrConnectWithoutDeviceAllocationsInput = {
    where: TenantWhereUniqueInput
    create: XOR<TenantCreateWithoutDeviceAllocationsInput, TenantUncheckedCreateWithoutDeviceAllocationsInput>
  }

  export type TenantSubscriptionCreateWithoutDeviceAllocationsInput = {
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    outlet: TenantOutletCreateNestedOneWithoutSubscriptionsInput
    discount?: DiscountCreateNestedOneWithoutSubscriptionsInput
    tenant: TenantCreateNestedOneWithoutSubscriptionInput
    subscriptionPlan: SubscriptionPlanCreateNestedOneWithoutSubscriptionInput
    subscriptionAddOn?: TenantSubscriptionAddOnCreateNestedManyWithoutTenantSubscriptionInput
  }

  export type TenantSubscriptionUncheckedCreateWithoutDeviceAllocationsInput = {
    id?: number
    tenantId: number
    outletId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedCreateNestedManyWithoutTenantSubscriptionInput
  }

  export type TenantSubscriptionCreateOrConnectWithoutDeviceAllocationsInput = {
    where: TenantSubscriptionWhereUniqueInput
    create: XOR<TenantSubscriptionCreateWithoutDeviceAllocationsInput, TenantSubscriptionUncheckedCreateWithoutDeviceAllocationsInput>
  }

  export type PushyDeviceUpsertWithoutAllocationInput = {
    update: XOR<PushyDeviceUpdateWithoutAllocationInput, PushyDeviceUncheckedUpdateWithoutAllocationInput>
    create: XOR<PushyDeviceCreateWithoutAllocationInput, PushyDeviceUncheckedCreateWithoutAllocationInput>
    where?: PushyDeviceWhereInput
  }

  export type PushyDeviceUpdateToOneWithWhereWithoutAllocationInput = {
    where?: PushyDeviceWhereInput
    data: XOR<PushyDeviceUpdateWithoutAllocationInput, PushyDeviceUncheckedUpdateWithoutAllocationInput>
  }

  export type PushyDeviceUpdateWithoutAllocationInput = {
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUser?: TenantUserUpdateOneRequiredWithoutPushyDevicesNestedInput
    subscriptions?: PushySubscriptionUpdateManyWithoutDeviceNestedInput
  }

  export type PushyDeviceUncheckedUpdateWithoutAllocationInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantUserId?: IntFieldUpdateOperationsInput | number
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: PushySubscriptionUncheckedUpdateManyWithoutDeviceNestedInput
  }

  export type TenantUpsertWithoutDeviceAllocationsInput = {
    update: XOR<TenantUpdateWithoutDeviceAllocationsInput, TenantUncheckedUpdateWithoutDeviceAllocationsInput>
    create: XOR<TenantCreateWithoutDeviceAllocationsInput, TenantUncheckedCreateWithoutDeviceAllocationsInput>
    where?: TenantWhereInput
  }

  export type TenantUpdateToOneWithWhereWithoutDeviceAllocationsInput = {
    where?: TenantWhereInput
    data: XOR<TenantUpdateWithoutDeviceAllocationsInput, TenantUncheckedUpdateWithoutDeviceAllocationsInput>
  }

  export type TenantUpdateWithoutDeviceAllocationsInput = {
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUpdateManyWithoutTenantNestedInput
    subscription?: TenantSubscriptionUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUpdateManyWithoutTenantNestedInput
  }

  export type TenantUncheckedUpdateWithoutDeviceAllocationsInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUncheckedUpdateManyWithoutTenantNestedInput
    subscription?: TenantSubscriptionUncheckedUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUncheckedUpdateManyWithoutTenantNestedInput
    warehouses?: TenantWarehouseUncheckedUpdateManyWithoutTenantNestedInput
  }

  export type TenantSubscriptionUpsertWithoutDeviceAllocationsInput = {
    update: XOR<TenantSubscriptionUpdateWithoutDeviceAllocationsInput, TenantSubscriptionUncheckedUpdateWithoutDeviceAllocationsInput>
    create: XOR<TenantSubscriptionCreateWithoutDeviceAllocationsInput, TenantSubscriptionUncheckedCreateWithoutDeviceAllocationsInput>
    where?: TenantSubscriptionWhereInput
  }

  export type TenantSubscriptionUpdateToOneWithWhereWithoutDeviceAllocationsInput = {
    where?: TenantSubscriptionWhereInput
    data: XOR<TenantSubscriptionUpdateWithoutDeviceAllocationsInput, TenantSubscriptionUncheckedUpdateWithoutDeviceAllocationsInput>
  }

  export type TenantSubscriptionUpdateWithoutDeviceAllocationsInput = {
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    outlet?: TenantOutletUpdateOneRequiredWithoutSubscriptionsNestedInput
    discount?: DiscountUpdateOneWithoutSubscriptionsNestedInput
    tenant?: TenantUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionPlan?: SubscriptionPlanUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionAddOn?: TenantSubscriptionAddOnUpdateManyWithoutTenantSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateWithoutDeviceAllocationsInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionNestedInput
  }

  export type TenantCreateWithoutWarehousesInput = {
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserCreateNestedManyWithoutTenantInput
    subscription?: TenantSubscriptionCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationCreateNestedManyWithoutTenantInput
  }

  export type TenantUncheckedCreateWithoutWarehousesInput = {
    id?: number
    tenantName: string
    databaseName?: string | null
    phoneNumber?: string | null
    createdAt?: Date | string
    tenantUsers?: TenantUserUncheckedCreateNestedManyWithoutTenantInput
    subscription?: TenantSubscriptionUncheckedCreateNestedManyWithoutTenantInput
    tenantOutlets?: TenantOutletUncheckedCreateNestedManyWithoutTenantInput
    deviceAllocations?: PushyDeviceAllocationUncheckedCreateNestedManyWithoutTenantInput
  }

  export type TenantCreateOrConnectWithoutWarehousesInput = {
    where: TenantWhereUniqueInput
    create: XOR<TenantCreateWithoutWarehousesInput, TenantUncheckedCreateWithoutWarehousesInput>
  }

  export type TenantUpsertWithoutWarehousesInput = {
    update: XOR<TenantUpdateWithoutWarehousesInput, TenantUncheckedUpdateWithoutWarehousesInput>
    create: XOR<TenantCreateWithoutWarehousesInput, TenantUncheckedCreateWithoutWarehousesInput>
    where?: TenantWhereInput
  }

  export type TenantUpdateToOneWithWhereWithoutWarehousesInput = {
    where?: TenantWhereInput
    data: XOR<TenantUpdateWithoutWarehousesInput, TenantUncheckedUpdateWithoutWarehousesInput>
  }

  export type TenantUpdateWithoutWarehousesInput = {
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUpdateManyWithoutTenantNestedInput
    subscription?: TenantSubscriptionUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutTenantNestedInput
  }

  export type TenantUncheckedUpdateWithoutWarehousesInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantName?: StringFieldUpdateOperationsInput | string
    databaseName?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    tenantUsers?: TenantUserUncheckedUpdateManyWithoutTenantNestedInput
    subscription?: TenantSubscriptionUncheckedUpdateManyWithoutTenantNestedInput
    tenantOutlets?: TenantOutletUncheckedUpdateManyWithoutTenantNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutTenantNestedInput
  }

  export type TenantSubscriptionCreateManySubscriptionPlanInput = {
    id?: number
    tenantId: number
    outletId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
  }

  export type TenantSubscriptionUpdateWithoutSubscriptionPlanInput = {
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    outlet?: TenantOutletUpdateOneRequiredWithoutSubscriptionsNestedInput
    discount?: DiscountUpdateOneWithoutSubscriptionsNestedInput
    tenant?: TenantUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionAddOn?: TenantSubscriptionAddOnUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateWithoutSubscriptionPlanInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateManyWithoutSubscriptionPlanInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type TenantSubscriptionAddOnCreateManyAddOnInput = {
    id?: number
    tenantSubscriptionId: number
    quantity?: number
  }

  export type TenantSubscriptionAddOnUpdateWithoutAddOnInput = {
    quantity?: IntFieldUpdateOperationsInput | number
    tenantSubscription?: TenantSubscriptionUpdateOneRequiredWithoutSubscriptionAddOnNestedInput
  }

  export type TenantSubscriptionAddOnUncheckedUpdateWithoutAddOnInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantSubscriptionId?: IntFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type TenantSubscriptionAddOnUncheckedUpdateManyWithoutAddOnInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantSubscriptionId?: IntFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type TenantUserCreateManyTenantInput = {
    id?: number
    username: string
    password?: string | null
    role?: string
    isDeleted?: boolean
  }

  export type TenantSubscriptionCreateManyTenantInput = {
    id?: number
    outletId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
  }

  export type TenantOutletCreateManyTenantInput = {
    id?: number
    outletName: string
    address?: string | null
    createdAt?: Date | string
    isActive?: boolean
  }

  export type PushyDeviceAllocationCreateManyTenantInput = {
    id?: number
    deviceId: number
    subscriptionId?: number | null
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
  }

  export type TenantWarehouseCreateManyTenantInput = {
    id?: number
    warehouseName: string
    warehouseCode: string
    address?: string | null
    isActive?: boolean
    deleted?: boolean
    deletedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TenantUserUpdateWithoutTenantInput = {
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    pushyDevices?: PushyDeviceUpdateManyWithoutTenantUserNestedInput
  }

  export type TenantUserUncheckedUpdateWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    pushyDevices?: PushyDeviceUncheckedUpdateManyWithoutTenantUserNestedInput
  }

  export type TenantUserUncheckedUpdateManyWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type TenantSubscriptionUpdateWithoutTenantInput = {
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    outlet?: TenantOutletUpdateOneRequiredWithoutSubscriptionsNestedInput
    discount?: DiscountUpdateOneWithoutSubscriptionsNestedInput
    subscriptionPlan?: SubscriptionPlanUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionAddOn?: TenantSubscriptionAddOnUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateManyWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type TenantOutletUpdateWithoutTenantInput = {
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    subscriptions?: TenantSubscriptionUpdateManyWithoutOutletNestedInput
  }

  export type TenantOutletUncheckedUpdateWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    subscriptions?: TenantSubscriptionUncheckedUpdateManyWithoutOutletNestedInput
  }

  export type TenantOutletUncheckedUpdateManyWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    outletName?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PushyDeviceAllocationUpdateWithoutTenantInput = {
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    device?: PushyDeviceUpdateOneRequiredWithoutAllocationNestedInput
    subscription?: TenantSubscriptionUpdateOneWithoutDeviceAllocationsNestedInput
  }

  export type PushyDeviceAllocationUncheckedUpdateWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceId?: IntFieldUpdateOperationsInput | number
    subscriptionId?: NullableIntFieldUpdateOperationsInput | number | null
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushyDeviceAllocationUncheckedUpdateManyWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceId?: IntFieldUpdateOperationsInput | number
    subscriptionId?: NullableIntFieldUpdateOperationsInput | number | null
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantWarehouseUpdateWithoutTenantInput = {
    warehouseName?: StringFieldUpdateOperationsInput | string
    warehouseCode?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantWarehouseUncheckedUpdateWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    warehouseName?: StringFieldUpdateOperationsInput | string
    warehouseCode?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantWarehouseUncheckedUpdateManyWithoutTenantInput = {
    id?: IntFieldUpdateOperationsInput | number
    warehouseName?: StringFieldUpdateOperationsInput | string
    warehouseCode?: StringFieldUpdateOperationsInput | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    deleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantSubscriptionAddOnCreateManyTenantSubscriptionInput = {
    id?: number
    addOnId: number
    quantity?: number
  }

  export type PushyDeviceAllocationCreateManySubscriptionInput = {
    id?: number
    deviceId: number
    tenantId: number
    addOnId?: number | null
    allocationType?: string
    activatedAt?: Date | string
    expiresAt?: Date | string | null
    createdAt?: Date | string
  }

  export type TenantSubscriptionAddOnUpdateWithoutTenantSubscriptionInput = {
    quantity?: IntFieldUpdateOperationsInput | number
    addOn?: SubscriptionAddOnUpdateOneRequiredWithoutSubscriptionsNestedInput
  }

  export type TenantSubscriptionAddOnUncheckedUpdateWithoutTenantSubscriptionInput = {
    id?: IntFieldUpdateOperationsInput | number
    addOnId?: IntFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionInput = {
    id?: IntFieldUpdateOperationsInput | number
    addOnId?: IntFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type PushyDeviceAllocationUpdateWithoutSubscriptionInput = {
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    device?: PushyDeviceUpdateOneRequiredWithoutAllocationNestedInput
    tenant?: TenantUpdateOneRequiredWithoutDeviceAllocationsNestedInput
  }

  export type PushyDeviceAllocationUncheckedUpdateWithoutSubscriptionInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceId?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceId?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    addOnId?: NullableIntFieldUpdateOperationsInput | number | null
    allocationType?: StringFieldUpdateOperationsInput | string
    activatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TenantSubscriptionCreateManyOutletInput = {
    id?: number
    tenantId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    discountId?: number | null
  }

  export type TenantSubscriptionUpdateWithoutOutletInput = {
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discount?: DiscountUpdateOneWithoutSubscriptionsNestedInput
    tenant?: TenantUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionPlan?: SubscriptionPlanUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionAddOn?: TenantSubscriptionAddOnUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateWithoutOutletInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateManyWithoutOutletInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    discountId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type TenantSubscriptionCreateManyDiscountInput = {
    id?: number
    tenantId: number
    outletId: number
    subscriptionPlanId: number
    status?: string
    nextPaymentDate: Date | string
    subscriptionValidUntil: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TenantSubscriptionUpdateWithoutDiscountInput = {
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    outlet?: TenantOutletUpdateOneRequiredWithoutSubscriptionsNestedInput
    tenant?: TenantUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionPlan?: SubscriptionPlanUpdateOneRequiredWithoutSubscriptionNestedInput
    subscriptionAddOn?: TenantSubscriptionAddOnUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateWithoutDiscountInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionAddOn?: TenantSubscriptionAddOnUncheckedUpdateManyWithoutTenantSubscriptionNestedInput
    deviceAllocations?: PushyDeviceAllocationUncheckedUpdateManyWithoutSubscriptionNestedInput
  }

  export type TenantSubscriptionUncheckedUpdateManyWithoutDiscountInput = {
    id?: IntFieldUpdateOperationsInput | number
    tenantId?: IntFieldUpdateOperationsInput | number
    outletId?: IntFieldUpdateOperationsInput | number
    subscriptionPlanId?: IntFieldUpdateOperationsInput | number
    status?: StringFieldUpdateOperationsInput | string
    nextPaymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionValidUntil?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushyDeviceCreateManyTenantUserInput = {
    id?: number
    deviceToken: string
    deviceFingerprint?: string | null
    platform: string
    deviceName?: string | null
    appVersion?: string | null
    isActive?: boolean
    lastActiveAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PushyDeviceUpdateWithoutTenantUserInput = {
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: PushySubscriptionUpdateManyWithoutDeviceNestedInput
    allocation?: PushyDeviceAllocationUpdateOneWithoutDeviceNestedInput
  }

  export type PushyDeviceUncheckedUpdateWithoutTenantUserInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: PushySubscriptionUncheckedUpdateManyWithoutDeviceNestedInput
    allocation?: PushyDeviceAllocationUncheckedUpdateOneWithoutDeviceNestedInput
  }

  export type PushyDeviceUncheckedUpdateManyWithoutTenantUserInput = {
    id?: IntFieldUpdateOperationsInput | number
    deviceToken?: StringFieldUpdateOperationsInput | string
    deviceFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    platform?: StringFieldUpdateOperationsInput | string
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null
    appVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushySubscriptionCreateManyDeviceInput = {
    id?: number
    topic: string
    subscribedAt?: Date | string
  }

  export type PushySubscriptionUpdateWithoutDeviceInput = {
    topic?: StringFieldUpdateOperationsInput | string
    subscribedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushySubscriptionUncheckedUpdateWithoutDeviceInput = {
    id?: IntFieldUpdateOperationsInput | number
    topic?: StringFieldUpdateOperationsInput | string
    subscribedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PushySubscriptionUncheckedUpdateManyWithoutDeviceInput = {
    id?: IntFieldUpdateOperationsInput | number
    topic?: StringFieldUpdateOperationsInput | string
    subscribedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}