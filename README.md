# side-hustle-server

## Getting started
Before you run the project, make sure to install all packages first by running `npm install`

After that, you will need to install `nodemon` package. This package is used to ease development process by auto-restarting the server everytime there is any changes saved. To run the server, use this command `nodemon src/index.ts`
[https://www.npmjs.com/package/nodemon]

To check whether your server is already running, open your browser and insert this address [http://localhost:3000/]. You should be able to see a sample "Hello World!" string returned.

To stop the server, navigate to your terminal and press `CTRL+C`

*** Remarks ***
remember to run `npx prisma migrate deploy` to make sure the migration other people created will execute on your db

## Endpoints
- (POST) /auth/login 
```sh
body: username, password
```
- (POST) /auth/validate-token 
```sh
body: token
```
- (POST) /auth/refresh-token 
```sh
body: refreshToken
```
- (POST) /auth/revoke-token 
```sh
header: token (this is access token)
body: token (this is refresh token)
```
- (GET) /auth/{id}/refresh-tokens
```sh
header: token
``` 
- (GET) /user
```sh
header: token
```
- (GET) /user/{id} 
```sh
header: token
```
- (POST) /user/create 
```sh
header: token
body: username, password, lastName, firstName, mobile, email, role
```
- (PUT) /user/update 
```sh
header: token
body: id, lastName, firstName, mobile, email, role
```
- (PUT) /user/change-password
```sh
header: token
body: userId, currentPassword, newPassword 
```
