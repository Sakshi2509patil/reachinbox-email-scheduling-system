// import nodemailer from "nodemailer";
// import { prisma } from "../db/prisma";

// /**
//  * Creates N fresh Ethereal test SMTP accounts (real accounts, provisioned
//  * live via Ethereal's API through nodemailer) and stores them as Senders.
//  * Run: npm run seed:senders -- 3
//  */
// async function main() {
//   const count = parseInt(process.argv[2] ?? "3", 10);

//   for (let i = 0; i < count; i++) {
//     const account = await nodemailer.createTestAccount();
//     const sender = await prisma.sender.create({
//       data: {
//         name: `Sender ${i + 1}`,
//         email: account.user,
//         smtpHost: account.smtp.host,
//         smtpPort: account.smtp.port,
//         smtpUser: account.user,
//         smtpPass: account.pass,
//       },
//     });
//     console.log(`Created sender: ${sender.name} <${sender.email}> (id=${sender.id})`);
//   }

//   await prisma.$disconnect();
// }

// main().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });
import nodemailer from "nodemailer";
import { prisma } from "../db/prisma";

/**
 * Creates N fresh Ethereal test SMTP accounts and stores them as Senders.
 * Skips an account if the email already exists in the database.
 *
 * Run:
 * npm run seed:senders -- 3
 */
async function main() {
  const count = parseInt(process.argv[2] ?? "3", 10);

  let created = 0;
  let attempts = 0;

  while (created < count) {
    attempts++;

    // Safety limit to avoid an infinite loop if Ethereal keeps returning
    // the same account.
    if (attempts > count * 10) {
      throw new Error(
        `Could not create ${count} unique Ethereal senders after ${attempts} attempts.`
      );
    }

    const account = await nodemailer.createTestAccount();

    const existingSender = await prisma.sender.findUnique({
      where: {
        email: account.user,
      },
    });

    if (existingSender) {
      console.log(
        `Skipping existing sender: ${existingSender.name} <${existingSender.email}>`
      );
      continue;
    }

    const sender = await prisma.sender.create({
      data: {
        name: `Sender ${created + 1}`,
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: account.pass,
      },
    });

    created++;

    console.log(
      `Created sender: ${sender.name} <${sender.email}> (id=${sender.id})`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});