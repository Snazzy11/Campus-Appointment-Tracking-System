# CATS iOS signing files (private, not in git)

Back this whole folder up somewhere private (a password manager). Apple only
lets you download the `.p8` once, and `dist.key` can't be recovered.

| File                             | What it is                                                         |
| -------------------------------- | ------------------------------------------------------------------ |
| `dist.key`                       | Private key for the distribution certificate                      |
| `dist.csr`                       | Signing request uploaded to Apple (only needed to remake the cert) |
| `distribution.cer` / `.pem`      | Apple Distribution certificate, team 7Z7S9RBX72, expires 2027-11-23 |
| `dist-cert.p12`                  | Certificate and key combined, uploaded to EAS                      |
| `p12-password.txt`               | Password for `dist-cert.p12`                                       |
| `CATS_App_Store.mobileprovision` | App Store profile for com.cmichcats.catsproject, expires 2027-11-23 |
| `AuthKey_HK7YF2VD4S.p8`          | App Store Connect API key (Key ID HK7YF2VD4S), used by EAS Submit  |

`../../credentials.json` points EAS at the `.p12` and profile for
`eas credentials` → "Upload credentials from credentials.json to EAS".

The renewal steps are in `front_end/README.md` → "Shipping a TestFlight build".
