-- Remove previously seeded sample sales exec data so only live data remains
-- Delete dependents first to satisfy FK constraints
delete from activities
 where customer_id in (
   select id from customers where company_name in ('Acme Imports','Bright Retailers','Canyon Logistics','Delta Traders','Everest Textiles')
 );

delete from follow_ups
 where customer_id in (
   select id from customers where company_name in ('Acme Imports','Bright Retailers','Canyon Logistics','Delta Traders','Everest Textiles')
 );

delete from appointments
 where customer_id in (
   select id from customers where company_name in ('Acme Imports','Bright Retailers','Canyon Logistics','Delta Traders','Everest Textiles')
 );

delete from opportunities
 where customer_id in (
   select id from customers where company_name in ('Acme Imports','Bright Retailers','Canyon Logistics','Delta Traders','Everest Textiles')
 );

delete from customers
 where company_name in ('Acme Imports','Bright Retailers','Canyon Logistics','Delta Traders','Everest Textiles');

-- targets table in legacy schema lacks name; skip target cleanup
