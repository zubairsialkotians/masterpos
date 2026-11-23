# MasterPOS

One staff app for every shop that runs on the shared shop backend (`shop/v1` on sialkotians.com).

- No customer ordering. The app opens on a staff login.
- Any staff login from any shop works: owner, branch admin, cashier, kitchen, rider — the same email and password as in the shop's own app.
- The server tells the app which shop the login belongs to (`POST /master/login`), and the app then works exactly like that shop's own app for that role.
- To switch shops, log out and log in with the other shop's login.

## Run

```
cp .env.example .env
npx expo start
```

## Builds

Set `EAS_PROJECT_ID` (`npx eas init`) and add a `google-services.json` for `com.sialkotians.masterpos` for push notifications on Android.
