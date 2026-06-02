import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const MOCK_ATTENDANCE_RECORDS = [
  { id: 1, date: "2026-05-05", in: "09:23 AM", out: "06:07 PM", ip: "192.168.100.39", uid: "61" },
  { id: 2, date: "2026-05-04", in: "09:18 AM", out: "06:02 PM", ip: "192.168.100.39", uid: "22" },
  { id: 3, date: "2026-05-02", in: "09:07 AM", out: "-", ip: "192.168.100.39", uid: "20057" },
  { id: 4, date: "2026-04-30", in: "09:45 AM", out: "06:05 PM", ip: "192.168.100.39", uid: "20027" },
  { id: 5, date: "2026-04-29", in: "09:32 AM", out: "06:00 PM", ip: "192.168.100.39", uid: "19984" },
  { id: 6, date: "2026-04-28", in: "09:17 AM", out: "06:01 PM", ip: "192.168.100.39", uid: "19940" },
  { id: 7, date: "2026-04-27", in: "09:21 AM", out: "06:59 PM", ip: "192.168.100.39", uid: "19901" },
  { id: 8, date: "2026-04-25", in: "09:20 AM", out: "06:05 PM", ip: "192.168.100.39", uid: "19867" },
  { id: 9, date: "2026-04-24", in: "09:18 AM", out: "06:03 PM", ip: "192.168.100.39", uid: "19822" },
  { id: 10, date: "2026-04-22", in: "09:16 AM", out: "06:01 PM", ip: "192.168.100.39", uid: "19754" },
  { id: 11, date: "2026-04-21", in: "09:23 AM", out: "06:03 PM", ip: "192.168.100.39", uid: "19719" },
  { id: 12, date: "2026-04-20", in: "09:13 AM", out: "06:05 PM", ip: "-", uid: "19684" },
  { id: 13, date: "2026-04-10", in: "09:28 AM", out: "-", ip: "-", uid: "19386" },
];

const BRANCHES = [
  "Lahore Gulburg Branch",
  "Lahore Raya Branch",
  "Sialkot Branch",
];

const MOCK_USERS_GULBERG = [
  { name: "Abdullah Tariq (M)", userId: "54474", attId: "5050", days: 87 },
  { name: "Abu Baker Saeed Upal", userId: "54388", attId: "5055", days: 73 },
  { name: "Adeel Ahmad", userId: "54617", attId: "5109", days: 10 },
  { name: "Amir Ishaq", userId: "54315", attId: "5046", days: 65 },
  { name: "Amir Nafees", userId: "54316", attId: "5047", days: 84 },
  { name: "Arslan Rehan", userId: "54239", attId: "5022", days: 88 },
  { name: "ASIF JAHANGEER", userId: "54210", attId: "5002", days: 89 },
  { name: "Ayesha shahbaz", userId: "54121", attId: "6007", days: 82 },
  { name: "Bilal Ramzan", userId: "54236", attId: "5019", days: 89 },
  { name: "Faheem Asghar", userId: "54521", attId: "5078", days: 83 },
  { name: "Faisal Shahzad", userId: "54582", attId: "5092", days: 54 },
  { name: "Hamza Sajid", userId: "54564", attId: "5087", days: 94 },
  { name: "Hassan Mubeen", userId: "54317", attId: "5044", days: 56 },
  { name: "Imran Ahmad", userId: "54128", attId: "5003", days: 89 },
  { name: "Jahanzeb Ali", userId: "54321", attId: "5049", days: 63 },
  { name: "Masood Abbas", userId: "54334", attId: "5050", days: 87 },
  { name: "Muhammad Ahmad", userId: "54129", attId: "5004", days: 78 },
  { name: "Muhammad Ahmed(i)", userId: "54514", attId: "5003", days: 89 },
  { name: "Muhammad Arshad", userId: "54513", attId: "5004", days: 78 },
  { name: "Muhammad Awais", userId: "54603", attId: "5101", days: 5 },
  { name: "Muhammad Habib Ahmed", userId: "54289", attId: "5034", days: 15 },
  { name: "Muhammad Hassan Abbas", userId: "54486", attId: "5076", days: 67 },
  { name: "Muhammad Inaam ul Haq (H)", userId: "54485", attId: "5034", days: 15 },
  { name: "Muhammad Khizar Hayyat", userId: "54365", attId: "5022", days: 88 },
  { name: "Muhammad Muaz Dhillon", userId: "54616", attId: "5108", days: 16 },
  { name: "Muhammad Nadeem Shahzad", userId: "54552", attId: "5085", days: 52 },
  { name: "Muhammad Nouman Khalid", userId: "54389", attId: "5056", days: 16 },
  { name: "Muhammad Saad Bin Amir", userId: "54615", attId: "5107", days: 13 },
  { name: "Muhammad Usman (N)", userId: "54481", attId: "5056", days: 16 },
  { name: "Muhammad Uzair", userId: "54299", attId: "5039", days: 83 },
  { name: "Naeem Ahmad", userId: "54200", attId: "5007", days: 32 },
  { name: "Qasim Khalil", userId: "54409", attId: "5064", days: 68 },
  { name: "Qasim Shah (M)", userId: "54473", attId: "5050", days: 87 },
  { name: "Rabia Iftikhar (N)", userId: "54482", attId: "5007", days: 32 },
  { name: "Rameen", userId: "54366", attId: "5022", days: 88 },
  { name: "Sami Imran", userId: "54567", attId: "5089", days: 1 },
  { name: "Saqlain Ali", userId: "54130", attId: "5005", days: 80 },
  { name: "Shahzaib", userId: "54410", attId: "5062", days: 89 },
  { name: "Sughra Bibi", userId: "54515", attId: "5003", days: 89 },
  { name: "Syed Ghulfam Haider Bukhari (M)", userId: "54475", attId: "5050", days: 87 },
  { name: "Umar Farooq(A)", userId: "54469", attId: "5002", days: 89 },
  { name: "Usman Asghar", userId: "54580", attId: "5091", days: 20 },
  { name: "Zaeem Shakeel", userId: "54598", attId: "5099", days: 17 },
  { name: "Zain Khalid", userId: "56", attId: "5022", days: 88 },
];

const MOCK_USERS_RAYA = [
  { name: "Abdul Razzaq (U)", userId: "54508", attId: "5052", days: 66 },
  { name: "Abdul Basit", userId: "54619", attId: "5111", days: 8 },
  { name: "Abdullah Khalil", userId: "54593", attId: "5097", days: 21 },
  { name: "Abdullah Noor Dogar", userId: "54581", attId: "5093", days: 6 },
  { name: "Arslan Aslam", userId: "54452", attId: "5074", days: 54 },
  { name: "Asad Munawar (Q)", userId: "54502", attId: "5068", days: 80 },
  { name: "Bilal Ahmed", userId: "54591", attId: "5095", days: 71 },
  { name: "Faisal Hayat", userId: "54618", attId: "5110", days: 10 },
  { name: "Faisal Shahzad", userId: "54582", attId: "5092", days: 32 },
  { name: "Hafiz Muhammad Mubashar Javed", userId: "54548", attId: "5082", days: 61 },
  { name: "Hamza Ibrahim", userId: "54611", attId: "5105", days: 30 },
  { name: "Hassam Akram", userId: "54620", attId: "5112", days: 10 },
  { name: "Hassan Ali", userId: "54584", attId: "5094", days: 27 },
  { name: "M.Waleed", userId: "52114", attId: "1084", days: 57 },
  { name: "Muhammad Ahmad", userId: "54622", attId: "5114", days: 10 },
  { name: "Muhammad Asim Shafique", userId: "54550", attId: "5083", days: 5 },
  { name: "Muhammad Aslam (A)", userId: "54476", attId: "5074", days: 54 },
  { name: "Muhammad Awais", userId: "54603", attId: "5101", days: 43 },
  { name: "Muhammad Habib Ahmed", userId: "54289", attId: "5034", days: 57 },
  { name: "Muhammad Hamza", userId: "54592", attId: "5096", days: 62 },
  { name: "MUHAMMAD HASEEB ALI RIZVI", userId: "54196", attId: "3", days: 1 },
  { name: "Muhammad Inaam ul Haq (H)", userId: "54485", attId: "5034", days: 57 },
  { name: "Muhammad Junaid", userId: "54353", attId: "1084", days: 57 },
  { name: "Muhammad Junaid Aazar", userId: "54274", attId: "1084", days: 57 },
  { name: "Muhammad Mohsin Ali", userId: "54597", attId: "5098", days: 61 },
  { name: "Muhammad Nouman Khalid", userId: "54389", attId: "5056", days: 72 },
  { name: "Muhammad Saeed (Q)", userId: "54504", attId: "5068", days: 80 },
  { name: "Muhammad Saim Arshad", userId: "54621", attId: "5113", days: 10 },
  { name: "Muhammad Sajid", userId: "54411", attId: "5063", days: 81 },
  { name: "Muhammad Talha Nazir Saleemi", userId: "54565", attId: "5088", days: 101 },
  { name: "Muhammad Umer Razzaq", userId: "54377", attId: "5052", days: 66 },
  { name: "Muhammad Usman (N)", userId: "54481", attId: "5056", days: 72 },
  { name: "Muzammil Javed", userId: "104", attId: "1084", days: 57 },
  { name: "Nisar Ahmad", userId: "54570", attId: "5090", days: 98 },
  { name: "Qamar Zia", userId: "54422", attId: "5068", days: 80 },
  { name: "Rana Ali Zeeshan", userId: "54451", attId: "5073", days: 62 },
  { name: "Rana Arshad Ali (R)", userId: "54477", attId: "5073", days: 62 },
  { name: "Roshan Ali Khan", userId: "54551", attId: "5084", days: 71 },
  { name: "SAFEER AHMED", userId: "54197", attId: "2", days: 2 },
  { name: "Sajjad Ali", userId: "54610", attId: "5104", days: 32 },
  { name: "Sajjad Hassan", userId: "54525", attId: "5079", days: 50 },
  { name: "Sameer Fiaz (Q)", userId: "54505", attId: "5068", days: 80 },
  { name: "Shahriyar Masih", userId: "54395", attId: "5061", days: 23 },
  { name: "Shahzaib Nasir", userId: "54600", attId: "5100", days: 47 },
  { name: "sharjeel Farooq (Q)", userId: "54503", attId: "5068", days: 80 },
  { name: "Syed Ali Sher Rizvi", userId: "54533", attId: "5081", days: 7 },
  { name: "Syed Mohsin Hussain Shah", userId: "54554", attId: "5086", days: 94 },
  { name: "Umair Javed", userId: "54118", attId: "1084", days: 57 },
  { name: "Umar Bin Shahid", userId: "54604", attId: "5102", days: 37 },
  { name: "Zaeem Shakeel", userId: "54598", attId: "5099", days: 29 },
];

const MOCK_USERS_SIALKOT = [
  { name: "Aamir Raza (F)", userId: "54404", attId: "212", days: 38 },
  { name: "Abdul Qadir", userId: "54262", attId: "1067", days: 36 },
  { name: "Abdul Rafay", userId: "54594", attId: "1205", days: 15 },
  { name: "Ahsan Ali", userId: "54571", attId: "1081", days: 25 },
  { name: "Ali Hussain", userId: "93", attId: "117", days: 35 },
  { name: "Ameer Hamza", userId: "54569", attId: "401", days: 35 },
  { name: "Amina Naseer", userId: "54559", attId: "390", days: 24 },
  { name: "Amina Shazadi", userId: "53338", attId: "262", days: 37 },
  { name: "Amina Shoukat", userId: "54455", attId: "360", days: 37 },
  { name: "Amina Tahir", userId: "54424", attId: "347", days: 40 },
  { name: "Anmol Waheed", userId: "54577", attId: "395", days: 39 },
  { name: "Areeba", userId: "54572", attId: "393", days: 33 },
  { name: "Arfa Naz", userId: "54612", attId: "417", days: 11 },
  { name: "Arif Aziz (S)", userId: "54528", attId: "1172", days: 36 },
  { name: "Arooj Hashmi", userId: "54490", attId: "369", days: 38 },
  { name: "Asghar Khan", userId: "53704", attId: "1001", days: 37 },
  { name: "Asifa Ghazanfar", userId: "54383", attId: "333", days: 35 },
  { name: "Asma Mazher", userId: "54258", attId: "311", days: 35 },
  { name: "Atia Rani", userId: "54436", attId: "356", days: 36 },
  { name: "Atika Riaz", userId: "54542", attId: "384", days: 36 },
  { name: "Ayesha Saleem", userId: "54414", attId: "344", days: 38 },
  { name: "Ayesha Shafique", userId: "54491", attId: "368", days: 37 },
  { name: "Bilal Ahmed", userId: "54553", attId: "1180", days: 37 },
  { name: "Ehtisham Shahid", userId: "54213", attId: "1049", days: 37 },
  { name: "ESHA ARSHAD", userId: "54209", attId: "300", days: 36 },
  { name: "Esha Shoukat", userId: "54586", attId: "407", days: 39 },
  { name: "Faiqa", userId: "54170", attId: "293", days: 35 },
  { name: "Faiza Khalid", userId: "47", attId: "212", days: 38 },
  { name: "Fareha", userId: "54429", attId: "352", days: 27 },
  { name: "Farhat Abdul Aziz", userId: "68", attId: "207", days: 35 },
  { name: "Farwa Shehzadi", userId: "53335", attId: "260", days: 37 },
  { name: "Fatima Zubair", userId: "54601", attId: "411", days: 34 },
  { name: "Ghazanfar ali", userId: "61", attId: "107", days: 27 },
  { name: "Ghufaar Gard", userId: "123", attId: "134", days: 1 },
  { name: "Hafiz Akhtar Ali", userId: "54361", attId: "1135", days: 1 },
  { name: "Hafsa Naseer", userId: "54435", attId: "357", days: 21 },
  { name: "Hareem Tariq", userId: "54418", attId: "346", days: 38 },
  { name: "Haris Gulab", userId: "99", attId: "133", days: 25 },
  { name: "Hasaan Ahmed", userId: "54459", attId: "1156", days: 26 },
  { name: "Hassan Azhar", userId: "54125", attId: "1021", days: 36 },
  { name: "Hifsa Abid", userId: "54583", attId: "405", days: 32 },
  { name: "Hina Arij", userId: "54173", attId: "295", days: 34 },
  { name: "Hussnain Khalil", userId: "54175", attId: "1030", days: 37 },
  { name: "Ibad Ur Rehman", userId: "54349", attId: "1123", days: 37 },
  { name: "Ikseer Mehmood (U)", userId: "54442", attId: "5070", days: 35 },
  { name: "Jannat Christina", userId: "54417", attId: "345", days: 29 },
  { name: "Jannat Fatima", userId: "54596", attId: "409", days: 36 },
  { name: "Jannat Naeem", userId: "54549", attId: "385", days: 12 },
  { name: "Jibran Razzaq", userId: "112", attId: "125", days: 36 },
  { name: "Kaleem Ullah", userId: "54606", attId: "1207", days: 25 },
  { name: "Kanwal Shehzadi", userId: "54402", attId: "341", days: 20 },
  { name: "Kashif Majeed", userId: "54426", attId: "5069", days: 36 },
  { name: "Khadija jamil", userId: "54364", attId: "1138", days: 38 },
  { name: "Khadija Maqsood", userId: "54188", attId: "298", days: 39 },
  { name: "Khadija pervaiz", userId: "54367", attId: "1139", days: 35 },
  { name: "Laiba fatima", userId: "54432", attId: "354", days: 31 },
  { name: "Luqman Muhammad(U)", userId: "52218", attId: "5070", days: 35 },
  { name: "M Ashjah", userId: "54456", attId: "1160", days: 32 },
  { name: "M Sajawal", userId: "54323", attId: "1106", days: 38 },
  { name: "M Shahid", userId: "100", attId: "159", days: 28 },
  { name: "M. Arslan Janjua", userId: "37", attId: "106", days: 30 },
  { name: "M.salman", userId: "39", attId: "124", days: 39 },
  { name: "Maira Butt", userId: "54433", attId: "351", days: 40 },
  { name: "Makhdoma", userId: "54605", attId: "410", days: 35 },
  { name: "Malaika Butt", userId: "54357", attId: "1130", days: 37 },
  { name: "Maria Imran", userId: "54461", attId: "364", days: 38 },
  { name: "Maria Rani", userId: "54369", attId: "1141", days: 37 },
  { name: "Marwa Iftikhar", userId: "54345", attId: "1120", days: 39 },
  { name: "Maryam Shahzadi", userId: "54587", attId: "403", days: 34 },
  { name: "Mawish Nadeem", userId: "54527", attId: "373", days: 37 },
  { name: "Mazhar Ul Haq", userId: "54184", attId: "1036", days: 37 },
  { name: "Mehak Shahzadi", userId: "54562", attId: "392", days: 35 },
  { name: "Mehreena Moeed", userId: "54270", attId: "314", days: 34 },
  { name: "Minahil", userId: "54543", attId: "383", days: 36 },
  { name: "Mohammad Tariq Janjua", userId: "54408", attId: "106", days: 30 },
  { name: "Mousa Jan", userId: "54599", attId: "1204", days: 2 },
  { name: "Mubashar Fazal", userId: "54340", attId: "1116", days: 32 },
  { name: "Muhammad Tayyab", userId: "54590", attId: "1206", days: 32 },
  { name: "Muhammad Abubakar", userId: "54453", attId: "1159", days: 37 },
  { name: "Muhammad Ali", userId: "54568", attId: "398", days: 40 },
  { name: "Muhammad Amin (T)", userId: "54493", attId: "109", days: 39 },
  { name: "Muhammad Anwar", userId: "54362", attId: "1135", days: 1 },
  { name: "Muhammad Faheem", userId: "54537", attId: "1201", days: 24 },
  { name: "Muhammad Farhan", userId: "54489", attId: "1164", days: 22 },
  { name: "Muhammad Furqan", userId: "54326", attId: "1107", days: 16 },
  { name: "Muhammad Hamaad Raza", userId: "54518", attId: "1171", days: 39 },
  { name: "Muhammad Hammad (J)", userId: "54501", attId: "141", days: 24 },
  { name: "Muhammad Imran", userId: "54405", attId: "124", days: 39 },
  { name: "Muhammad Jawad", userId: "52112", attId: "141", days: 24 },
  { name: "Muhammad Mamoon", userId: "54613", attId: "1189", days: 28 },
  { name: "Muhammad Maqsood", userId: "54307", attId: "1093", days: 36 },
  { name: "Muhammad Mehfooz", userId: "54419", attId: "1099", days: 36 },
  { name: "Muhammad Mukkarram Khan", userId: "54574", attId: "400", days: 39 },
  { name: "Muhammad Nadeem Zulfiqar", userId: "43", attId: "112", days: 37 },
  { name: "Muhammad Naseem Afridi (K)", userId: "54511", attId: "5069", days: 36 },
  { name: "Muhammad Razaq (J)", userId: "54495", attId: "125", days: 36 },
  { name: "Muhammad Tuqeer Razaq", userId: "118", attId: "129", days: 37 },
  { name: "Muhammad Umer Nawaz", userId: "54407", attId: "138", days: 35 },
  { name: "Muhammad Zyaan Majeed (K)", userId: "54444", attId: "5069", days: 36 },
  { name: "Nimra Shahzadi", userId: "54546", attId: "379", days: 38 },
  { name: "Nirmal Ashknaz", userId: "54471", attId: "361", days: 33 },
  { name: "Noor Fatima", userId: "54368", attId: "1140", days: 36 },
  { name: "Noreen Aftab", userId: "54607", attId: "414", days: 1 },
  { name: "Pir Khurram Khaleeq (U)", userId: "54440", attId: "5070", days: 35 },
  { name: "Rabia Majeed (K)", userId: "54510", attId: "5069", days: 36 },
  { name: "Rabia Riaz", userId: "54623", attId: "420", days: 14 },
  { name: "Ramish Khurram", userId: "54266", attId: "312", days: 34 },
  { name: "Rehan Ali", userId: "54374", attId: "1144", days: 37 },
  { name: "Rehman Faisal", userId: "35", attId: "104", days: 38 },
  { name: "Rohina Munir", userId: "63", attId: "221", days: 39 },
  { name: "Roshan Aslam", userId: "54278", attId: "1083", days: 37 },
  { name: "Rumaisa Rizwan", userId: "54579", attId: "397", days: 8 },
  { name: "Rushba Noor", userId: "54588", attId: "402", days: 34 },
  { name: "Sahar Bano", userId: "54412", attId: "342", days: 38 },
  { name: "Sahil Shabir", userId: "53112", attId: "1118", days: 36 },
  { name: "Saim Tariq", userId: "54", attId: "138", days: 35 },
  { name: "Samia Rani", userId: "54457", attId: "362", days: 28 },
  { name: "Samriya Razzaq", userId: "54589", attId: "406", days: 34 },
  { name: "Sana e Mustafa", userId: "54219", attId: "1051", days: 38 },
  { name: "Saqib Majeed (K)", userId: "54509", attId: "5069", days: 36 },
  { name: "Sarosh Farid", userId: "54425", attId: "349", days: 39 },
  { name: "Shafia Jamal (U)", userId: "54439", attId: "5070", days: 35 },
  { name: "Shahzad", userId: "54158", attId: "1027", days: 37 },
  { name: "SHAHZAIB ZAFAR", userId: "54192", attId: "1041", days: 38 },
  { name: "Shakeel Sikandar", userId: "54304", attId: "1092", days: 40 },
  { name: "Sheirsh Rehman", userId: "54406", attId: "104", days: 38 },
  { name: "Sherharyar(WA)", userId: "52104", attId: "105", days: 33 },
  { name: "Simran Hina", userId: "54595", attId: "408", days: 31 },
  { name: "Sodais Ahmed", userId: "54522", attId: "1172", days: 36 },
  { name: "Sonia Mubashar (M)", userId: "54467", attId: "1116", days: 32 },
  { name: "SYED HURR ABBAS", userId: "54191", attId: "1040", days: 38 },
  { name: "Syed Hussain Ijaz", userId: "54371", attId: "1128", days: 34 },
  { name: "Syed Kashif Shah", userId: "54470", attId: "112", days: 37 },
  { name: "Syeda Ayesha Gillani", userId: "54608", attId: "416", days: 26 },
  { name: "Syeda Mehak Fatima", userId: "54563", attId: "391", days: 36 },
  { name: "Tahir Mehmood Bhatti", userId: "52799", attId: "179", days: 32 },
  { name: "Taimoor Ahmed", userId: "52444", attId: "168", days: 35 },
  { name: "Tammawul Khaleeq (U)", userId: "54443", attId: "5070", days: 35 },
  { name: "Tayyab Mustafa", userId: "54286", attId: "1075", days: 33 },
  { name: "Tuseef Abbas", userId: "90", attId: "109", days: 39 },
  { name: "Umay kalsoom", userId: "54294", attId: "319", days: 38 },
  { name: "Umer Rabbani (U)", userId: "54441", attId: "5070", days: 35 },
  { name: "Umm E Arooba", userId: "54487", attId: "367", days: 36 },
  { name: "Usman Anwar Mirza", userId: "54427", attId: "5070", days: 35 },
  { name: "Waqas Ahmad(g)", userId: "54403", attId: "107", days: 27 },
  { name: "Waqas Ahmed", userId: "36", attId: "105", days: 33 },
  { name: "Warda Akhtar", userId: "54398", attId: "334", days: 37 },
  { name: "Zain Ahmed", userId: "54122", attId: "1011", days: 36 },
  { name: "Zain naveed", userId: "54313", attId: "1101", days: 36 },
  { name: "Zainab Asifa (K)", userId: "54484", attId: "5069", days: 36 },
  { name: "Zill E Huma", userId: "53965", attId: "275", days: 37 },
  { name: "Zohaib Nisar Ahmad", userId: "40", attId: "131", days: 36 },
  { name: "zumar", userId: "54190", attId: "299", days: 36 },
];

export default function ReportsRawAttendance() {
  const [activeBranch, setActiveBranch] = useState("Lahore Gulburg Branch");
  const [autoUpload, setAutoUpload] = useState(false);
  const [showAlert, setShowAlert] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const displayedUsers = activeBranch === "Lahore Raya Branch" ? MOCK_USERS_RAYA : 
                        activeBranch === "Lahore Gulburg Branch" ? MOCK_USERS_GULBERG : 
                        activeBranch === "Sialkot Branch" ? MOCK_USERS_SIALKOT : [];

  return (
    <div className="flex-1 overflow-auto bg-white min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <h1 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
          ZKT ATTENDANCE REPORT
        </h1>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 font-semibold">
              Process Attendance
            </Button>
            <div 
              className="flex items-center space-x-2 border border-slate-200 rounded-md px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => {
                setAutoUpload(!autoUpload);
                setShowAlert(true);
              }}
            >
              <Checkbox 
                id="auto-upload" 
                checked={autoUpload} 
                className="data-[state=checked]:bg-slate-800"
              />
              <label
                htmlFor="auto-upload"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 cursor-pointer"
              >
                Auto Upload Attendance
              </label>
            </div>
          </div>
          <div className="text-sm text-slate-400">
            Current year attendance only. Missing days = leave, Sunday/Public Holiday skip.
          </div>
        </div>

        {showAlert && (
          <div className="bg-[#dff0d8] border border-[#d6e9c6] text-[#3c763d] px-4 py-3 rounded-md text-sm font-medium relative">
            Auto attendance {autoUpload ? 'enabled' : 'disabled'} successfully.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {BRANCHES.map(branch => (
            <button
              key={branch}
              onClick={() => setActiveBranch(branch)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                activeBranch === branch 
                  ? "bg-[#5c7cfa] text-white" 
                  : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {branch}
            </button>
          ))}
        </div>

        <div className="pt-2">
          <h2 className="text-sm font-bold text-slate-700 mb-4">
            Total Users: {displayedUsers.length}
          </h2>

          <div className="space-y-3">
            {displayedUsers.map((user, idx) => {
              const isExpanded = expandedUserId === user.userId;
              
              return (
              <div 
                key={idx} 
                className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden"
              >
                <div 
                  onClick={() => setExpandedUserId(isExpanded ? null : user.userId)}
                  className={`flex items-center justify-between p-3 px-4 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'bg-[#f8f9fa] hover:border-slate-300'}`}
                >
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-bold text-slate-700 text-sm">{user.name}</span>
                    <span className="text-xs font-semibold text-slate-400">
                      (User ID: {user.userId} | Att ID: {user.attId})
                    </span>
                    <span className="bg-[#e9ecef] text-slate-500 text-xs font-bold px-2.5 py-0.5 rounded-full ml-1">
                      Total Attendance Days: {user.days}
                    </span>
                  </div>
                  {isExpanded ? (
                    <Minus className="h-4 w-4 text-slate-600 shrink-0" />
                  ) : (
                    <Plus className="h-4 w-4 text-slate-600 shrink-0" />
                  )}
                </div>
                
                {isExpanded && (
                  <div className="bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-center">
                        <thead className="bg-[#343a40] text-white">
                          <tr>
                            <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">#</th>
                            <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Date</th>
                            <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Check In Time</th>
                            <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Check Out Time</th>
                            <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Office</th>
                            <th className="py-3 px-4 font-semibold text-xs border-r border-slate-600 whitespace-nowrap">Device IP</th>
                            <th className="py-3 px-4 font-semibold text-xs whitespace-nowrap">UID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {MOCK_ATTENDANCE_RECORDS.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 text-slate-500 font-medium">{record.id}</td>
                              <td className="py-3 px-4 text-slate-600 font-medium">{record.date}</td>
                              <td className="py-3 px-4 text-slate-600 font-medium">{record.in}</td>
                              <td className="py-3 px-4 text-slate-600 font-medium">{record.out}</td>
                              <td className="py-3 px-4 text-slate-500">{activeBranch}</td>
                              <td className="py-3 px-4 text-slate-500">{record.ip}</td>
                              <td className="py-3 px-4 text-slate-500">{record.uid}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      </div>
    </div>
  );
}
