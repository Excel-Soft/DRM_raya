import pkg from 'pg';
const { Pool } = pkg;
import "../server/utils/env"; // This will load the .env file

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

const products = [
    "Apparel", "Health & Medical", "Sports Wear", "Casual Wear", "Fitness Wear",
    "Martial Arts Wear", "Safety Wear", "Boxing Equipments", "Leather products",
    "Weightlifting", "Beach Wear", "Band Uniform", "Gloves Range", "Accessories",
    "Embroidery Badges", "Masonic Regalia", "Horse Riding", "Footballs",
    "Surgical Instruments", "Dental Instruments", "Beauty Instruments",
    "Orthopedic Instruments", "veterinary Instruments", "Hunting Jacket",
    "Hunting Hoodies", "Hunting Suit", "Hunting Vest", "Restricted Products",
    "Trash Products", "Finances & Insurance", "Business Services", "Computers & Internet",
    "Entertainment & Media", "Events & Conferences", "Food & Drink", "Health & Beauty",
    "Legal", "Manufacturing & Industry", "Public & Social Services", "Shopping",
    "Tourism & Accommodation", "Tradesmen & Construction", "Transport & Motoring",
    "Property", "Plumbing & Sanitary", "Building Materials", "Contractors",
    "plumbing-sanitary", "Real Estate", "General Service", "Expansion bolts",
    "Expansion anchors", "Drop in anchor & cut anchor", "Drop in anchor", "Curtain walling",
    "Contract manufacturing", "Continuity systems", "Channel", "Cast in channels",
    "Build forming parts", "Brickwork ties", "Brickwork supports", "Brickwork restraints",
    "Binu mathew", "Anker", "Anchoring systems", "Sockets", "Fixing", "Fasteners",
    "Channels", "Angles", "Anchors", "Nails", "Bolts", "Manufacturer", "Ties", "Chains",
    "Building", "Precast Concrete Suppliers", "Trading", "landscaping", "Vehical services",
    "Rental Property", "Property Management", "Real Estate Developers", "Jewellery",
    "General Office Services", "Computer Software", "Event Equipment",
    "COLLEGE AND UNIVERSITIES", "Financial Activity", "Transportation", "Brokers",
    "Film, Television & Video", "online content", "Sports", "Furniture", "Restaurants",
    "Beauty Products", "Fashion", "Procurement", "cloths", "photography", "Marketing",
    "Beauty Proffesionals", "docter & clinics", "Home & Garden", "Industrial Equipments",
    "Home & Kitchen", "Pharmacies", "School", "Hotels", "Energy Supplies", "consultant",
    "cleaning services", "Industrial Supplies", "natural gas", "Banks", "Saloon",
    "Textile", "Engineering", "Oil & Natural Gas"
];

async function seed() {
    const client = await pool.connect();
    try {
        console.log("Starting seeding with DATABASE_URL...");
        for (const name of products) {
            // Check if product already exists
            const res = await client.query("SELECT 1 FROM products WHERE name = $1 LIMIT 1", [name]);
            if (res.rowCount === 0) {
                const sku = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
                await client.query(
                    "INSERT INTO products (name, sku, stock, price, cost) VALUES ($1, $2, 999, 0, 0)",
                    [name, sku]
                );
                console.log(`Added: ${name}`);
            } else {
                console.log(`Skipped (exists): ${name}`);
            }
        }
        console.log("Seeding completed successfully.");
    } catch (err) {
        console.error("Seeding failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
