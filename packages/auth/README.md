# @smounters/auth

Механика OAuth2/OIDC без привязки к продукту: адрес авторизации, PKCE, обмен кода, проверка `id_token`
по JWKS, приведение профиля к одному виду.

```bash
npm i @smounters/auth jose
```

Пакет **не знает** ни про роли, ни про сессии, ни про сопоставление аккаунтов — это политика, она
живёт в приложении и выкатывается вместе с ним, а не с релизом npm.

```ts
import { buildAuthorizeUrl, codeChallenge, describeProvider, exchangeCode, fetchProfile, randomToken }
  from "@smounters/auth/oauth";

const descriptor = describeProvider("google");
const config = { clientId, clientSecret, redirectUri };

const verifier = randomToken();
const url = await buildAuthorizeUrl({
  descriptor, config,
  state: myState,                       // где хранить — решает приложение
  nonce, codeChallenge: await codeChallenge(verifier),
});

// после возврата провайдера
const tokens = await exchangeCode({ descriptor, config, code, codeVerifier: verifier });
const profile = await fetchProfile({ descriptor, config, tokens, nonce });
// { provider, subject, email, emailVerified, name, picture, hostedDomain, raw }
```

## Провайдеры

`google`, `microsoft`, `linkedin`, `facebook` и **`oidc`** — последний работает по discovery-документу,
то есть покрывает свой Keycloak/Authentik/Zitadel без единой строки кода: достаточно передать
`discoveryUrl` в настройках клиента.

`verifiesEmail` у описания провайдера — **не косметика**. Он означает «провайдер сообщает о
подтверждении почты, и этому можно верить». У Facebook он `false`: почта может быть неподтверждённой
или отсутствовать. Если приложение привязывает существующий аккаунт по совпадению почты, гейтить это
надо именно этим признаком — иначе аккаунт достанется тому, кто зарегистрирует чужой адрес.
