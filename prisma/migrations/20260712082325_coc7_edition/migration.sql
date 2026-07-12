-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "edition" TEXT NOT NULL DEFAULT '6',
    "name" TEXT NOT NULL,
    "playerName" TEXT,
    "occupation" TEXT,
    "age" INTEGER,
    "sex" TEXT,
    "imageUrl" TEXT,
    "luck" INTEGER,
    "str" INTEGER NOT NULL,
    "con" INTEGER NOT NULL,
    "pow" INTEGER NOT NULL,
    "dex" INTEGER NOT NULL,
    "app" INTEGER NOT NULL,
    "siz" INTEGER NOT NULL,
    "int" INTEGER NOT NULL,
    "edu" INTEGER NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "currentMp" INTEGER NOT NULL,
    "currentSan" INTEGER NOT NULL,
    "skillsJson" TEXT NOT NULL DEFAULT '{}',
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Character" ("age", "app", "con", "createdAt", "currentHp", "currentMp", "currentSan", "dex", "edu", "id", "imageUrl", "int", "memo", "name", "occupation", "playerName", "pow", "sex", "siz", "skillsJson", "str", "updatedAt") SELECT "age", "app", "con", "createdAt", "currentHp", "currentMp", "currentSan", "dex", "edu", "id", "imageUrl", "int", "memo", "name", "occupation", "playerName", "pow", "sex", "siz", "skillsJson", "str", "updatedAt" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

