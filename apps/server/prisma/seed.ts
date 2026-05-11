import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  await p.channel.upsert({
    where: { slug: "general" },
    create: { name: "General", slug: "general" },
    update: {},
  });
  console.log("Seeded: channel #general");
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
