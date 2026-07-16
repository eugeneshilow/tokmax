# Release: как выкатить новую версию CLI

Обновлено: 2026-07-16. Раньбук появился после захода 2026-07-16, когда агент
не нашёл в доках ни слова про npm-ключи и оставил `npm publish` «владельцу».

## Где живут ключи (npm-аккаунт `eugeneshilow`)

| Машина | Состояние | Проверка |
| --- | --- | --- |
| **Air** | ✅ рабочий токен в `~/.npmrc` | `npm whoami` → `eugeneshilow` |
| **Pro** | ❌ токен протух (401 на 2026-07-16) | обновить: `npm login` на Pro |

Публикуешь с той машины, где `npm whoami` отвечает. Сегодня это **Air**;
с Pro удобно через SSH: `ssh air` (alias в `~/.ssh/config` Pro).
Токен в доки не писать — только где он лежит.

## Шаги релиза

1. Бамп `cli/package.json` → PR → merge (или прямо в main — solo-репо).
2. `cd cli && npm pack` → получаешь `tokmax-X.Y.Z.tgz`.
3. С машины с ключом: `npm publish tokmax-X.Y.Z.tgz`
   (тарбол можно `scp` на Air и публиковать там; 2FA-OTP спросит — есть у владельца).
4. Проверка: `npm view tokmax version`.

## Не забыть: дневные джобы гоняют ГЛОБАЛЬНУЮ установку, не npx

`npm publish` сам по себе машины не чинит — launchd-джобы зовут глобальный
пакет по абсолютному пути. После релиза обновить на обеих машинах:

| Машина | Джоб | Глобальный путь | Обновление |
| --- | --- | --- | --- |
| Pro | `tech.vibecoding.tokmax.daily` (18:21) | `~/.local/share/fnm/node-versions/v22.23.1/installation/lib/node_modules/tokmax` | `npm i -g tokmax@latest` |
| Air | `tech.vibecoding.tokmax.daily` | `~/.npm-global/lib/node_modules/tokmax` | `ssh air 'npm i -g tokmax@latest'` (PATH: `/opt/homebrew/Cellar/node@24/24.16.0/bin`) |

После обновления — контрольный `tokmax publish` на каждой машине и глазами
проверить `https://tokmax.vibecoding.tech/eugeneshilow` (сумма машин, cli-версия).

## Соседние джобы на Air — не трогать

`ru.vibecoding.token-maxing.air` (01:59) — НЕ токмакс и НЕ легаси: пушит
usage-снапшоты в Convex основного репо (`ops_token_maxing`) и кормит плитку
ЦУПа «Агентский парк» (`/admin/machine` vibecoding.ru). Легаси-аудит
`ru.vibecoding.tokenmaxxing.weekly-audit` удалён 2026-07-16 (аудитил
отставленный роут `/tokenmaxxing`, теперь 307 на токмакс).
