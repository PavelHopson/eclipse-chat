-- Private interface preferences, isolated from publicly visible profiles.
CREATE TABLE "UserAppearance" (
    "userId" TEXT NOT NULL,
    "palette" TEXT NOT NULL,
    CONSTRAINT "UserAppearance_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "UserAppearance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
