import { prisma } from '../lib/db/client';

async function main() {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      sessionId: true,
    }
  });

  console.log('Messages in database:');
  console.log('====================');
  messages.forEach((msg, i) => {
    console.log(`${i + 1}. [${msg.role}] ${msg.content.substring(0, 80)}...`);
    console.log(`   Created: ${msg.createdAt}`);
    console.log('');
  });

  console.log(`Total messages found: ${messages.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
