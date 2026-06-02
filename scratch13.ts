import { getVasReport } from './server/reports-routes'; // wait I can't import easily because it's not exported
// I will just fetch from the API

fetch('http://localhost:5000/api/reports/vas?userId=52d42bc6-be6f-4cce-81bc-132ce0c18f68', {
  headers: {
    'Cookie': 'connect.sid=s%3A...' // need auth
  }
});
