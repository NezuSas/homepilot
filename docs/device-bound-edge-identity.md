# Edge device identity on the production MiniPC

Production bound installations require Linux, TPM 2.0, accessible `/dev/tpmrm0`, and `tpm2-tools` in the HomePilot API runtime. Add `docker-compose.tpm.yml` as an override only on these installations; historical unbound installations do not need the device mapping. The TPM's persistent HomePilot signing key uses handle `0x81010090`; the private key is never exported or stored in SQLite, `.env`, an image, or logs.

After the Edge credential is provisioned, run the explicit `dist/scripts/enroll-edge-device.js` command in the API runtime. Do not run it on each boot. A Directory `DEVICE_ALREADY_BOUND` response requires NEZU recovery; this version does not rebind or replace keys. The SQLite binding row stores only public metadata and never silently reverts to legacy. Loss of the TPM key puts the API in diagnostic-only `NOT_READY / DEVICE_IDENTITY_INVALID`; `/health` explains the state without exposing key material. Directory connectivity is not required to pass the local check.

`HOMEPILOT_DEVICE_IDENTITY_PROVIDER=software` is available only outside production for development/CI. The development private key file lives beside the development SQLite DB with owner-only permissions. It is **NOT CLONE RESISTANT** and is never a production fallback for a bound installation.
