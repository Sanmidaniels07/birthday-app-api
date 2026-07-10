import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const INTERESTS = [
  'Music', 'Movies & TV', 'Gaming', 'Reading', 'Writing', 'Art & Design',
  'Photography', 'Cooking', 'Baking', 'Fitness', 'Running', 'Football',
  'Basketball', 'Travel', 'Hiking', 'Camping', 'Tech', 'Coding',
  'Entrepreneurship', 'Investing', 'Fashion', 'Beauty', 'Faith & Spirituality',
  'Volunteering', 'Board Games', 'Anime', 'Podcasts', 'Dancing', 'Singing',
  'Languages', 'Science', 'History', 'Cars', 'Pets', 'Gardening', 'DIY & Crafts',
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function main() {
  for (const name of INTERESTS) {
    const slug = slugify(name);
    await prisma.interest.upsert({
      where: { slug },
      update: { name }, 
      create: { name, slug },
    });
  }
  console.log(`Seeded ${INTERESTS.length} interests.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });