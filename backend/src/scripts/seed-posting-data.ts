import "./env";
import { db } from "../server/db";
import { productPostingData, restrictedKeywords } from "../shared/schema";

async function seed() {
  console.log("Seeding posting data...");

  // Clear existing data (optional, but good for a "real data" feel)
  // await db.delete(productPostingData);
  // await db.delete(restrictedKeywords);

  const products = [
    {
      category: "Electronics",
      title: "Sony WH-1000XM4 Wireless Noise Cancelling Over-Ear Headphones",
      keywords: "Sony, Headphones, Noise Cancelling, Bluetooth Audio, Wireless",
      description: "Industry-leading noise canceling with Dual Noise Sensor technology. Next-level music with Edge-AI, co-developed with Sony Music Studios Tokyo.",
      mainImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
      platform: "Amazon",
      status: "Live",
    },
    {
      category: "Electronics",
      title: "Apple MacBook Pro 14-inch (M3 Pro Chip)",
      keywords: "MacBook Pro, Apple, M3 Pro, Laptop, Creative Workstation",
      description: "The most advanced chips ever built for a personal computer. M3, M3 Pro, and M3 Max chips deliver more performance and speed.",
      mainImage: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80",
      platform: "Apple Store",
      status: "Live",
    },
    {
      category: "Fashion",
      title: "Levi's Men's 501 Original Fit Jeans - Rigid",
      keywords: "Levis, 501, Denim, Jeans, Men's Fashion, Classic",
      description: "Close your eyes. Think “jeans.” Now open. They were 501s®, right? They’re literally the blueprint for every pair of jeans in existence.",
      mainImage: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&auto=format&fit=crop&q=80",
      platform: "eBay",
      status: "Live",
    },
    {
      category: "Fashion",
      title: "Nike Air Max 270 - White/Black/Anthracite",
      keywords: "Nike, Air Max, Sneakers, Running, Lifestyle Shoes",
      description: "Nike's first lifestyle Air Max brings you style, comfort and big attitude in the Nike Air Max 270.",
      mainImage: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80",
      platform: "Nike.com",
      status: "Live",
    },
    {
      category: "Home & Garden",
      title: "Instant Pot Duo 7-in-1 Electric Pressure Cooker",
      keywords: "Instant Pot, Pressure Cooker, Kitchen Appliance, Slow Cooker",
      description: "Instant Pot Duo is the world’s best selling multi-cooker. It combines 7 appliances in one.",
      mainImage: "https://images.unsplash.com/photo-1581450257008-01e4ed4e1c21?w=800&auto=format&fit=crop&q=80",
      platform: "Walmart",
      status: "Pending",
    },
    {
      category: "Industrial",
      title: "DEWALT 20V MAX Cordless Drill Combo Kit",
      keywords: "Dewalt, Power Tools, Cordless Drill, Construction, Industrial",
      description: "Compact, lightweight design fits into tight areas. High speed transmission delivers two speeds.",
      mainImage: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop&q=80",
      platform: "Home Depot",
      status: "Live",
    },
    {
      category: "Beauty",
      title: "Dior Sauvage Eau de Parfum",
      keywords: "Dior, Fragrance, Cologne, Men's Grooming, Sauvage",
      description: "The powerful freshness of Sauvage exudes new sensual and mysterious facets.",
      mainImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      platform: "Sephora",
      status: "Live",
    },
    {
      category: "Leather products",
      title: "Premium Full Grain Leather Wallet - Bifold",
      keywords: "Leather, Wallet, Handmade, Men's Accessories, Genuine Leather",
      description: "Crafted from ethically sourced full-grain leather that develops a beautiful patina over time.",
      mainImage: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80",
      platform: "Etsy",
      status: "Live",
    },
    {
      category: "veterinary Instruments",
      title: "Stainless Steel Veterinary Surgical Scissors",
      keywords: "Veterinary, Surgical, Scissors, Medical, Stainless Steel",
      description: "Professional grade stainless steel scissors designed for precision veterinary procedures.",
      mainImage: "https://images.unsplash.com/photo-1576091160550-217359f40f8c?w=800&auto=format&fit=crop&q=80",
      platform: "MedLine",
      status: "Live",
    },
    {
      category: "Apparel",
      title: "Performance Cotton Men's T-Shirt - Navy",
      keywords: "T-shirt, Apparel, Fashion, Cotton, Activewear",
      description: "Lightweight, breathable cotton t-shirt built for all-day comfort and performance.",
      mainImage: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
      platform: "Zalando",
      status: "Live",
    },
    {
      category: "Hunting Jacket",
      title: "Camouflage Waterproof Insulated Hunting Jacket",
      keywords: "Hunting, Jacket, Camo, Waterproof, Outdoor Gear",
      description: "Stay warm and dry in the most rugged conditions with our premium insulated camo jacket.",
      mainImage: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop&q=80",
      platform: "Bass Pro Shops",
      status: "Live",
    },
    {
      category: "Hunting Hoodies",
      title: "Standard Issue Hunting Pullover Hoodie",
      keywords: "Hoodie, Hunting, Camouflage, Outdoor, Pullover",
      description: "Comfortable and stealthy camo hoodie perfect for forest and field use.",
      mainImage: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&auto=format&fit=crop&q=80",
      platform: "Cabela's",
      status: "Pending",
    },
    {
      category: "Hunting Suit",
      title: "Ghillie Suit - Professional Sniper Camouflage",
      keywords: "Hunting, Suit, Ghillie, Sniper, Camouflage",
      description: "The ultimate 3D camouflage suit for complete concealment in forest environments.",
      mainImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
      platform: "Army Surplus",
      status: "Live",
    },
  ];

  for (let i = 0; i < 16; i++) {
    products.push({
      category: "Leather products",
      title: `Leather Wallet Sample ${i+1}`,
      keywords: "Leather, Wallet",
      description: "Sample leather wallet for testing counts.",
      mainImage: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80",
      platform: "Etsy",
      status: "Live",
    });
  }

  // Adding more pending items for verification testing
  const pendingItems = [
    {
       category: "Leather products",
       title: "Custom Tooled Leather Belt",
       keywords: "Leather, Belt, Custom, Accessory",
       description: "A solid full-grain leather belt featuring intricate hand-tooled floral designs.",
       mainImage: "https://images.unsplash.com/photo-1624222247344-550fb8ec5021?w=800&auto=format&fit=crop&q=80",
       platform: "Shopify",
       status: "Pending",
    },
    {
       category: "veterinary Instruments",
       title: "Veterinary Stethoscope - Cardiology Grade",
       keywords: "Stethoscope, Veterinary, Medical, Cardiology",
       description: "High-sensitivity stethoscope designed specifically for small animal clinics.",
       mainImage: "https://images.unsplash.com/flagged/photo-1576091160550-217359f40f8c?w=800&auto=format&fit=crop&q=80",
       platform: "Alibaba",
       status: "Pending",
    },
    {
       category: "Apparel",
       title: "Tactical Cargo Pants - Khaki",
       keywords: "Apparel, Cargo Pants, Tactical, Hunting Gear",
       description: "Multi-pocket heavy-duty trousers designed for outdoor activities and durability.",
       mainImage: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=80",
       platform: "Amazon",
       status: "Pending",
    },
    {
       category: "Hunting Jacket",
       title: "Thermal Base Layer Set - Fleece Lined",
       keywords: "Hunting, Underwear, Thermal, Winter, Gear",
       description: "Essential base layer set providing maximum warmth during extended cold weather hunts.",
       mainImage: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&auto=format&fit=crop&q=80",
       platform: "eBay",
       status: "Pending",
    },
    {
       category: "Costumes",
       title: "Medieval Knight Armor Suit",
       keywords: "Costumes, Medieval, Knight, Armor, Cosplay",
       description: "Full wearable medieval knight armor suit set for reenactment.",
       mainImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
       platform: "Amazon",
       status: "Live",
    },
    {
       category: "TV & Movie Costumes",
       title: "Super Hero Premium Spandex Suit",
       keywords: "Superhero, Movie Costume, Cosplay, Spandex",
       description: "High-quality screen-accurate superhero costume made from breathable spandex.",
       mainImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
       platform: "Shopify",
       status: "Live",
    },
    {
       category: "Mascot",
       title: "Giant Plush Bear Costume",
       keywords: "Mascot, Bear, Plush, Event Costume",
       description: "Commercial grade giant plush bear mascot head and body.",
       mainImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
       platform: "Alibaba",
       status: "Live",
    }
  ];

  products.push(...pendingItems);

  for (const product of products) {
    try {
      await db.insert(productPostingData).values({
        ...product,
        otherImages: [],
      });
    } catch (e) {
      console.error("Error inserting product:", e);
    }
  }

  const keywords = ["fake", "scam", "illegal", "drug", "weapon", "replica", "counterfeit"];
  for (const kw of keywords) {
    try {
      await db.insert(restrictedKeywords).values({
        keyword: kw,
      }).onConflictDoNothing();
    } catch (e) {
      console.error("Error inserting keyword:", e);
    }
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
