-- Create related_customers table for managing customer relationships
CREATE TABLE IF NOT EXISTS related_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    related_customer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_related_customers_customer_name ON related_customers(customer_name);
CREATE INDEX IF NOT EXISTS idx_related_customers_created_at ON related_customers(created_at DESC);
