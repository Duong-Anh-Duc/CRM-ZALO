import { PrismaClient } from '@prisma/client';

export async function seedCategories(prisma: PrismaClient) {
  const categories = [
    { name: 'Chai nhựa', children: ['Chai PET', 'Chai HDPE', 'Chai PP'] },
    { name: 'Lọ nhựa', children: ['Lọ mỹ phẩm', 'Lọ dược phẩm'] },
    { name: 'Can nhựa', children: ['Can 1L-5L', 'Can 10L-20L'] },
    { name: 'Hũ nhựa', children: ['Hũ tròn', 'Hũ vuông'] },
    { name: 'Phụ kiện', children: ['Nắp vặn', 'Nắp bơm', 'Nắp xịt', 'Nắp flip-top'] },
  ];

  for (const cat of categories) {
    const parent = await prisma.category.upsert({
      where: { id: cat.name.toLowerCase().replace(/\s/g, '-') },
      update: {},
      create: { id: cat.name.toLowerCase().replace(/\s/g, '-'), name: cat.name, sort_order: categories.indexOf(cat) },
    });

    for (let i = 0; i < cat.children.length; i++) {
      const childName = cat.children[i];
      await prisma.category.upsert({
        where: { id: childName.toLowerCase().replace(/\s/g, '-') },
        update: {},
        create: {
          id: childName.toLowerCase().replace(/\s/g, '-'),
          name: childName,
          parent_id: parent.id,
          sort_order: i,
        },
      });
    }
  }
}
