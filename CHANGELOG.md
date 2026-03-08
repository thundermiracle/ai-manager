# Changelog

## [0.4.0](https://github.com/thundermiracle/ai-manager/compare/ai-manager-v0.3.0...ai-manager-v0.4.0) (2026-03-08)


### Features

* add client capability matrix for resource scopes ([e273572](https://github.com/thundermiracle/ai-manager/commit/e273572b0e7df08051648b7604095b94ee8f0c4a))
* add source-aware resource contracts and request plumbing ([#115](https://github.com/thundermiracle/ai-manager/issues/115)) ([0924d5d](https://github.com/thundermiracle/ai-manager/commit/0924d5d056e812929eec27530e8f5b8ae8a83e0c))
* normalize and validate project context roots ([225c8ab](https://github.com/thundermiracle/ai-manager/commit/225c8ab6d694bdc78e79604fc213507168215442))
* **rust:** normalize and validate project context roots ([#113](https://github.com/thundermiracle/ai-manager/issues/113)) ([225c8ab](https://github.com/thundermiracle/ai-manager/commit/225c8ab6d694bdc78e79604fc213507168215442))

## [0.3.0](https://github.com/thundermiracle/ai-manager/compare/ai-manager-v0.2.2...ai-manager-v0.3.0) (2026-03-06)


### Features

* add manifest checksum handling for skill management ([091d9f8](https://github.com/thundermiracle/ai-manager/commit/091d9f84b29e9f3935ef0a2f1d4c8a33efa479b5))
* compare mcp settings to prevent from duplicated adding ([e202e2c](https://github.com/thundermiracle/ai-manager/commit/e202e2c44a8e08c0c4c00717fdcc5be593f51074))
* remember GitHub repository URL in SkillAddForm ([513c4f0](https://github.com/thundermiracle/ai-manager/commit/513c4f054af6079fb893ecc86de6dfb84097dcba))


### Bug Fixes

* adding mcp for claude code ([a2baa37](https://github.com/thundermiracle/ai-manager/commit/a2baa3791edb5c9a2733cb6d92b608b0b2408f8c))

## [0.2.2](https://github.com/thundermiracle/ai-manager/compare/ai-manager-v0.2.1...ai-manager-v0.2.2) (2026-03-04)


### Bug Fixes

* App detection ([057452b](https://github.com/thundermiracle/ai-manager/commit/057452b252bbc42473ce17a4c26ef873c624905d))

## [0.2.1](https://github.com/thundermiracle/ai-manager/compare/ai-manager-v0.2.0...ai-manager-v0.2.1) (2026-03-03)


### Bug Fixes

* claude detection ([975f2f3](https://github.com/thundermiracle/ai-manager/commit/975f2f3b3a44f33b316c74d5b239cf7a1e230f91))


### Performance Improvements

* improve mcp tab performance ([f0af6b6](https://github.com/thundermiracle/ai-manager/commit/f0af6b6e6385564d527c8663f99655ae0d10f133))

## [0.2.0](https://github.com/thundermiracle/ai-manager/compare/ai-manager-v0.1.0...ai-manager-v0.2.0) (2026-03-02)


### Features

* add copy function to mcp page ([c7b6533](https://github.com/thundermiracle/ai-manager/commit/c7b6533f159206fc8b2bed11fb1d9769e2c97081))
* add copy to function into skill manager ([ae948e7](https://github.com/thundermiracle/ai-manager/commit/ae948e735b926ec825e9c8b975133b79102bb0b1))
* add document link icon ([2c1bb57](https://github.com/thundermiracle/ai-manager/commit/2c1bb577ee10650385fac3073a160b25514a77f1))
* add error taxonomy and UI state contract (issue [#12](https://github.com/thundermiracle/ai-manager/issues/12)) ([11713ed](https://github.com/thundermiracle/ai-manager/commit/11713ed41cf60ffc37dd5b2aab5b5a56ecaa342c))
* add MVP acceptance checklist and explicit non-goals contract (issue [#13](https://github.com/thundermiracle/ai-manager/issues/13)) ([1e81e7f](https://github.com/thundermiracle/ai-manager/commit/1e81e7f883853485d7ed427fc718fc1f0d8facf9))
* add normalized domain model spec and schema (issue [#11](https://github.com/thundermiracle/ai-manager/issues/11)) ([49545c8](https://github.com/thundermiracle/ai-manager/commit/49545c8b410fcab634d978e1b2ac263f6f537742))
* add recovery-focused diagnostics UX for failure paths ([#58](https://github.com/thundermiracle/ai-manager/issues/58)) ([a0fda58](https://github.com/thundermiracle/ai-manager/commit/a0fda58050a0df6fb750d796b661aba2287d0e27))
* bootstrap Tauri 2 + React/TypeScript foundation (issue [#14](https://github.com/thundermiracle/ai-manager/issues/14)) ([edf1b44](https://github.com/thundermiracle/ai-manager/commit/edf1b44d35dff62ccfc449889b51b859c4dc577f))
* enable remote skill adding ([558ddd5](https://github.com/thundermiracle/ai-manager/commit/558ddd50f6781d0bd757495cec5e7ab622b6c88b))
* implement cli detectors for Claude Code and Codex CLI (issue [#19](https://github.com/thundermiracle/ai-manager/issues/19)) ([7cc0ee3](https://github.com/thundermiracle/ai-manager/commit/7cc0ee301a7744511789ba5af518288b522f48eb))
* implement desktop detectors for Cursor and Codex App (issue [#20](https://github.com/thundermiracle/ai-manager/issues/20)) ([6cdf3ee](https://github.com/thundermiracle/ai-manager/commit/6cdf3ee4ec13b1e6d2dda57d5a0c028e96c02f03))
* implement shared detector framework and evidence schema (issue [#18](https://github.com/thundermiracle/ai-manager/issues/18)) ([381ab6a](https://github.com/thundermiracle/ai-manager/commit/381ab6a5ad6c6078e74974f41b63ed9dfc2a7893))
* **issue-10:** support matrix, pnpm policy, and CI baseline ([5607c00](https://github.com/thundermiracle/ai-manager/commit/5607c00e34bec8d55261b27bacaca88fa75c8545))
* make mcp, skills editable ([fcdba2d](https://github.com/thundermiracle/ai-manager/commit/fcdba2dd254065c93d85e4e5254c7f3f34fddd6e))
* **mcp:** add unified listing and filtering model ([#22](https://github.com/thundermiracle/ai-manager/issues/22)) ([763b2cb](https://github.com/thundermiracle/ai-manager/commit/763b2cba4bd4284bf75055d1237fac7c1dd2fb45))
* **mutation:** add backup/atomic-write/rollback infrastructure ([#24](https://github.com/thundermiracle/ai-manager/issues/24)) ([a370da8](https://github.com/thundermiracle/ai-manager/commit/a370da88d945b25ea906849fa62e8023014c0433))
* **parsers:** add fixture-driven parser framework ([#21](https://github.com/thundermiracle/ai-manager/issues/21)) ([89e0cb5](https://github.com/thundermiracle/ai-manager/commit/89e0cb570701602b0c7222d103af0dda465820b7))
* redact sensitive data in command and UI paths ([#56](https://github.com/thundermiracle/ai-manager/issues/56)) ([8dff96d](https://github.com/thundermiracle/ai-manager/commit/8dff96d8680a68872cfc269323187dc0177e94f8))
* **release:** add macOS DMG packaging pipeline ([#59](https://github.com/thundermiracle/ai-manager/issues/59)) ([9867c97](https://github.com/thundermiracle/ai-manager/commit/9867c9717555c360aae6af0eb6916adac703dd38))
* **rust:** implement MCP add/remove mutation handlers (issue [#25](https://github.com/thundermiracle/ai-manager/issues/25)) ([55d944e](https://github.com/thundermiracle/ai-manager/commit/55d944ec192cb8eab63e1bac994f61b8051cc13d))
* **rust:** implement skill add/remove mutation handlers (issue [#26](https://github.com/thundermiracle/ai-manager/issues/26)) ([c1ced4d](https://github.com/thundermiracle/ai-manager/commit/c1ced4da1741608b677c06716a13f36fb08c0bb9))
* scaffold adapter interfaces and module boundaries (issue [#16](https://github.com/thundermiracle/ai-manager/issues/16)) ([16c2a5e](https://github.com/thundermiracle/ai-manager/commit/16c2a5e6a386d1160dffe156405e933298f18327))
* scaffold backend command boundary and app state container (issue [#15](https://github.com/thundermiracle/ai-manager/issues/15)) ([b80071c](https://github.com/thundermiracle/ai-manager/commit/b80071c1379a49862fe3fc73abbce6a0b27f8389))
* **skills:** add unified Skills listing and metadata mapping ([#23](https://github.com/thundermiracle/ai-manager/issues/23)) ([7f4f891](https://github.com/thundermiracle/ai-manager/commit/7f4f8912b6f4f9a16d8d2232e52b8d16f37d48f0))
* **ts:** add app shell, navigation, and client status dashboard (issue [#27](https://github.com/thundermiracle/ai-manager/issues/27)) ([3a49010](https://github.com/thundermiracle/ai-manager/commit/3a49010cf2b49b7d337574987fb0449be7c5b515))
* **ts:** implement MCP management tab with add/remove flows (issue [#28](https://github.com/thundermiracle/ai-manager/issues/28)) ([0d1c214](https://github.com/thundermiracle/ai-manager/commit/0d1c21440b62d41c85557f290fe8d134343cfb6e))
* **ts:** implement Skills management tab with add/remove flows (issue [#29](https://github.com/thundermiracle/ai-manager/issues/29)) ([29d2b8c](https://github.com/thundermiracle/ai-manager/commit/29d2b8ce2d169d1c499769ace34615bf028fc692))


### Bug Fixes

* **ci:** format rust modules and prevent icon source overwrite ([#95](https://github.com/thundermiracle/ai-manager/issues/95)) ([f1079b7](https://github.com/thundermiracle/ai-manager/commit/f1079b76e3346f3ac4ce4114ce3d382daba0ac22))
* mcp, skill deletion bug ([1efb3a6](https://github.com/thundermiracle/ai-manager/commit/1efb3a68d062beeb8c42a0f49c2babbaad5b98c7))
