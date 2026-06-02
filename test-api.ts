import http from "http";

async function testApi() {
  const payload = {
    companyName: "QA Test",
    personName: "QA Person",
    ab: "", country: "", phone: "", city: "", address: "qwertyu", companyType: "Option A", crmId: "1234", crmDate: "2026-04-25",
    title: "", cnic: "", ntn: "", website: "", email: "bilo@gmail.com", mobile: "03456678990", designation: "Option A", comment: "okay",
    rcLink: "", source: "", status: "", grade: "", businessLine: "", serviceTypes: ["Digital Marketing"]
  };

  const req = http.request("http://localhost:5000/api/customers/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Add fake auth cookie or token if needed, but it will probably 401 without it
      "Cookie": "connect.sid=fake" // This might fail if the server relies on secure sessions
    }
  }, (res) => {
    let raw = "";
    res.on("data", (c) => raw += c);
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Response:", raw);
    });
  });
  req.on("error", (e) => console.error(e));
  req.write(JSON.stringify(payload));
  req.end();
}
testApi();
