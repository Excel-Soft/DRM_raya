# VAS Report Code Extract — For Claude Review

Source file: `func (1).php` (uploaded by user)
Purpose: focused extraction of three VAS-related report paths and their helper functions. This is a review/reference document, **not a standalone executable PHP file**. The snippets retain the original business logic; line numbers refer to the source file at extraction time.

## Instructions for Claude
1. Review the three report paths below and trace all direct/indirect dependencies in the full application.
2. Do not rewrite or change business rules yet. First explain current behavior, input parameters, SQL/data sources, calculations, and output.
3. Identify bugs, security risks (especially SQL injection), date/filter inconsistencies, missing-result handling, and performance problems.
4. Propose a minimal safe refactor that preserves existing behavior, and list any assumptions/questions before changing code.
5. The snippets are extracted from a larger PHP file and include `else if` branches; they require their original surrounding controller/context to run.
6. Do not invent missing schema or functionality. Verify every dependency against the original project.


---

## 1. VAS Payment Report

Original source lines: 29772–29839. Trigger: `$DateFillterLoaddata == 'Vas'`. Displays company, amount, method, status (mapped to New/Renewal), date, and a total.

```php
    } else if ($DateFillterLoaddata == 'Vas') {
        $output = '<table id="Vasbvexpor" class="table table-bordered table-striped table-hover">
                                            <thead>
                                                <tr class="table-danger">
                                                    <th>#</th>
                                                    <th>Company</th>
                                                    <th>Amount</th>
                                                    <th>Method</th>
                                                    <th>Status</th>
                                                    <th>Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>';
        $n = 0;
        $totalAmount = 0;
        $query = "SELECT * FROM webxl_payments  ORDER BY `id` DESC";
        $retval = mysqli_query($con, $query);
        $cot = mysqli_num_rows($retval);
        if ($cot > 0) {
            $row = mysqli_fetch_assoc($retval);
            do {
                $coData = comData($row['com_id']);
                $payInvoice = payInvoice($row['invoice_id']);
                $payInv_u = $payInvoice['user_id'];
                $domain_renewal = $payInvoice['domain_renewal'];
                if ($domain_renewal == 0) {
                    $domain_renewal = 'New';
                } else {
                    $domain_renewal = 'Renewal';
                }
                $uId = $coData['assignId'];
                $da = $row['create_date'];
                $mouth = date("Y-m-d", strtotime($da));
                $mo = date("Y-m-d", strtotime($start));
                $mo2 = date("Y-m-d", strtotime($end));
                $ITDashDomainsDetail = ITDashDomainsDetail($row['com_id']);
                $reg_dateY = date("Y", strtotime($ITDashDomainsDetail['reg_date']));
                $reg_dateCY = date("Y");
                if ($reg_dateY == $reg_dateCY) {
                    $domain_renewal0 = 'New';
                } else {
                    $domain_renewal0 = 'Renewal';
                }
                if ($mouth >= $mo && $mouth <= $mo2) {
                    $n++;

                    $totalAmount = $totalAmount + $row['amount'];
                    $output .= '<tr>
                 <td>' . $n . '</td>
                 <td>' . $coData['cname'] . '</td>
                <td>' . $row['amount'] . '</td>
               <td>' . $row['method'] . '</td>
               <td>' . $domain_renewal . '</td>
               <td>' . $row['create_date'] . '</td>
            
            
             </tr>';
                }
            } while ($row = mysqli_fetch_assoc($retval));
        }
        $output .= '<tr>
                 <td><b>................</b></td>
                 <td><b>Total</b></td>
                 <td><b>' . $totalAmount . '</b></td>
                 <td><b>................</b></td>
                 <td><b>................</b></td>
                 <td><b>................</b></td>
                 </tr>';
```

---

## 2. VAS Commission Report (all users)

Original source lines: 29912–30006. Trigger: `$DateFillterLoaddata == 'Vas-Comission'` (spelling preserved from source). Calculates commission from monthly VAS amount with hard-coded tiers and reward values.

```php
    } else if ($DateFillterLoaddata == 'Vas-Comission') {
        $output = '<table id="Vasbvexpor" class="table table-bordered table-striped table-hover">
                                           <thead>
                                                <tr class="table-info">
                                                    <th>#</th>
                                                    <th>Date</th>
                                                    <th>Person</th>
                                                    <th>Total</th>
                                                    <th>%</th>
                                                    <th>Reward</th>
                                                    <th>Comm</th>
                                                    <th>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>';
        $n = 0;
        $totalAmount = 0;
        $per = 0;
        $perReward = 0;
        $comm = 0;
        $finalcomm = 0;
        $totalAmountFinal = 0;
        $perRewardFinal = 0;
        $finalcommFinal = 0;
        $commFinal = 0;
        $qury1 = "SELECT * FROM webxl_user GROUP BY user_id";
        $run1 = mysqli_query($con, $qury1);
        $row1 = mysqli_fetch_assoc($run1);
        do {

            $value1 = $row1['roleId'];
            $va = explode(",", $value1);

            // if (in_array($rule_id, $va))
            // {

            $totalAmount = userMonthlyAchiveTarget50Kor100Kor150K2Inv($row1['user_id'], $start, $end);
            if ($totalAmount != 0) {
                $n++;
                if ($totalAmount >= '50000' && $totalAmount < '100000') {
                    $perReward = 2500;
                    $per = 15;
                    $comm = ($per / 100) * $totalAmount;
                    $finalcomm = $perReward + $comm;
                } elseif ($totalAmount >= '100000' && $totalAmount < '150000') {
                    $perReward = 5000;
                    $per = 15;
                    $comm = ($per / 100) * $totalAmount;
                    $finalcomm = $perReward + $comm;
                } elseif ($totalAmount >= '150000') {
                    $per = 15;
                    $perReward = 8000;
                    $comm = ($per / 100) * $totalAmount;
                    $finalcomm = $perReward + $comm;
                } elseif ($totalAmount >= '1000' && $totalAmount < '50000') {
                    $per = 10;
                    $perReward = 0;
                    $comm = ($per / 100) * $totalAmount;
                    $finalcomm = $perReward + $comm;
                } else {
                    $per = 0;
                    $perReward = 0;
                    $comm = ($per / 100) * $totalAmount;
                    $finalcomm = $perReward + $comm;
                }
                $totalAmountFinal = $totalAmountFinal + $totalAmount;
                $perRewardFinal = $perRewardFinal + $perReward;
                $finalcommFinal = $finalcommFinal + $finalcomm;
                $commFinal = $commFinal + $comm;
                $output .= '<tr>
                    						<td>' . $n . '</td>
                 							
                                            <td>' . date('m/d/Y', strtotime($start)) . ' To ' . date('m/d/Y', strtotime($end)) . '</td>
                							<td>' . $row1['name'] . '</td>
               								<td>' . $totalAmount . '</td>
               								<td>' . $per . '</td>
               								<td>' . $perReward . '</td>
               								<td>' . $comm . '</td>
               								<td>' . $finalcomm . '</td>
             								</tr>';

                // }
            }
        } while ($row1 = mysqli_fetch_assoc($run1));

        $output .= '<tr>
                 <td><b>................</b></td>
                 <td><b>Total</b></td>
                 <td><b>................</b></td>
                 <td><b>................</b></td>
                 <td><b>................</b></td>
                 <td><b>................</b></td>
                 <td><b>' . round($finalcommFinal, 0) . '</b></td>
                 <td><b>................</b></td>
                 </tr>';
```

---

## 3. Person-wise / month-wise VAS Commission Report

Original source lines: 38640–38649 (request inputs) and 38772–38870 (report branch). The handler is named `user_id_reception_view`, and it also contains Reception Report branches; verify how the UI routes here before changing it. This branch runs when `$user_vas !== 'All' && $user_id_vas_view_month_waise == 'month_waise'`.

```php
if (isset($_POST['user_id_reception_view'])) {

    $user_vas = $_POST['user_id_reception_view'];
    $user_id_vas_view_month_waise = $_POST['user_id_vas_view_month_waise'];

    $startData = $_POST['startData'];
    $endData = $_POST['endData'];
    $startDay = date("d", strtotime($startData));
    $endDay = date("d", strtotime($endData));
    $total = 0;
// ... other branches exist between the input block and the month-wise branch ...
    } else if ($user_vas !== 'All' && $user_id_vas_view_month_waise == 'month_waise') {

        $output = '<table id="Vasbvexpor" class="table table-bordered table-striped table-hover">
                                            <thead>
                                                <tr class="table-danger">
                                                    <th>#</th>
                                                    <th>Date</th>
                                                    <th>Person</th>
                                                    <th>Total</th>
                                                    <th>%</th>
                                                    <th>Reward</th>
                                                    <th>Comm</th>
                                                    <th>Amount</th>
                                                   
                                                </tr>
                                            </thead>
                                            <tbody>';
        $n = 0;
        $totalAmount = 0;
        $per = 0;
        $perReward = 0;
        $comm = 0;
        $finalcomm = 0;
        $totalAmountFinal = 0;
        $perRewardFinal = 0;
        $finalcommFinal = 0;
        $commFinal = 0;

        $months = months_between_dates($startData, $endData);

        foreach ($months as $month) {

            $totalAmount = userMonthlyAchiveTarget50Kor100Kor150K2Inv($user_vas, $month . '-' . $startDay, $month . '-' . $endDay);



            if ($totalAmount != 0) {

                $compines = json_decode(userVAStargetPer($user_vas));

                foreach ($compines as $list) {
                    if ($totalAmount >= $list->price && $totalAmount <= $list->max_amount) {
                        $comm = round(($list->conversion / 100) * $totalAmount, 0);
                        $finalcomm = $list->reward + $comm;

                        $totalAmountFinal = $totalAmountFinal + $totalAmount;
                        $perRewardFinal = $perRewardFinal + $list->reward;
                        $finalcommFinal = $finalcommFinal + $finalcomm;
                        $commFinal = $commFinal + $comm;
                        $n++;
                        $output .= '<tr>
                    						<td>' . $n . '</td>
                 							<td>' . $month . '-' . $startDay . ' To ' . $month . '-' . $endDay . '</td>
                							<td>' . (username($user_vas)) . '</td>
               								<td>' . $totalAmount . '</td>
               								<td>' . $list->conversion . '</td>
               								<td>' . $list->reward . '</td>
               								<td>' . $comm . '</td>
               								<td>' . $finalcomm . '</td>
               								
             								</tr>';
                    }
                }
            }
        }

        $output .= '</tbody>  <tfoot>
    <tr>
      <td><b class-"text-danger">Due</b></td>
      <td><b class-"text-danger">' . (AllDuePaymentsPendingByUserByDate($user_vas, $startData, $endData)) . '</b></td>
      <td><b>Total</b></td>
      <td><b>' . $totalAmountFinal . '</b></td>
      <td></td>
      <td><b>' . $perRewardFinal . '</b></td>
      <td><b>' . $commFinal . '</b></td>
      <td><b>' . $finalcommFinal . '</b></td>
    </tr>
  </tfoot> </table>
  <script>
$(document).ready(function() {
    $("#Vasbvexpor").DataTable( {
        dom: "Bfrtip",
        searching: false,
        paging: false,
        buttons: [
            { extend: "copyHtml5", footer: true },
            { extend: "excelHtml5", footer: true },
            { extend: "csvHtml5", footer: true },
            { extend: "pdfHtml5", footer: true }
        ]
    });

} );
     </script>
  ';
        // }while($row= mysqli_fetch_assoc($run));


        echo $output;
```

---

## 4. Helper functions referenced by the extracted report code

The functions below are included where found in the uploaded source. Additional dependencies may exist inside these functions and must be traced in the full project.

### `userTotalAmount()`

```php
function userTotalAmount($user_id)
{
    global $con;
    $query = "SELECT webxl_payments.com_id,webxl_payments.amount, SUM(webxl_payments.amount) AS TotalMonthVas FROM webxl_payments LEFT JOIN webxl_company ON webxl_payments.com_id=webxl_company.id WHERE webxl_company.assignId = '$user_id'";
    $runu = mysqli_query($con, $query);
    $rowu = mysqli_fetch_assoc($runu);
    $cotu = mysqli_num_rows($runu);
    $TotalMonthVas = $rowu['TotalMonthVas'];
    return $TotalMonthVas;
}
```

### `userMonthlyAchiveTarget()`

```php
function userMonthlyAchiveTarget($user_id)
{
    global $con;
    $query = "SELECT webxl_payments.com_id,webxl_payments.amount,webxl_payments.create_date, SUM(webxl_payments.amount) AS TotalMonthVas FROM webxl_payments LEFT JOIN webxl_company ON webxl_payments.com_id=webxl_company.id WHERE webxl_company.assignId = '$user_id' AND  MONTH(webxl_payments.create_date) = MONTH(now()) AND YEAR(webxl_payments.create_date) = YEAR(now())";
    $runu = mysqli_query($con, $query);
    $rowu = mysqli_fetch_assoc($runu);
    $cotu = mysqli_num_rows($runu);
    $TotalMonthVas = $rowu['TotalMonthVas'];
    return $TotalMonthVas;
}
```

### `userVAStargetAchiveCount()`

```php
function userVAStargetAchiveCount($user_id, $craeteDate)
{
    global $con;
    $query = "SELECT webxl_payments.com_id,webxl_payments.amount,webxl_payments.create_date, SUM(webxl_payments.amount) AS TotalMonthVas FROM webxl_payments LEFT JOIN webxl_company ON webxl_payments.com_id=webxl_company.id WHERE webxl_company.assignId = '$user_id' AND  MONTH(webxl_payments.create_date) = '$craeteDate' AND YEAR(webxl_payments.create_date) = YEAR(now())";
    $runu = mysqli_query($con, $query);
    $rowu = mysqli_fetch_assoc($runu);
    $cotu = mysqli_num_rows($runu);
    $TotalMonthVas = $rowu['TotalMonthVas'];
    return $TotalMonthVas;
}
```

### `userVAStarget()`

```php
function userVAStarget($user_id, $price)
{
    global $con;
    $query = "SELECT webxl_setterget.terget_cat,webxl_setterget.user_id,webxl_setterget.terget_id,webxl_setterget.start_date,webxl_setterget.end_date, 
    webxl_terget.terget_name,webxl_terget.target_number,webxl_terget.price,webxl_terget.conversion,webxl_terget.bonus,webxl_terget.price,webxl_terget.max_amount
    FROM webxl_setterget LEFT JOIN webxl_terget ON webxl_setterget.terget_id=webxl_terget.terget_id WHERE webxl_setterget.terget_cat='3' AND webxl_setterget.user_id = '$user_id'
     AND webxl_terget.price <= '$price' AND webxl_terget.max_amount >= '$price' AND webxl_setterget.start_date = '0000-00-00' AND webxl_setterget.end_date = '0000-00-00'";
    $runu = mysqli_query($con, $query);
    $rowu = mysqli_fetch_assoc($runu);
    $totalVasTarget = $rowu['max_amount'];
    // $userABtarget = mysqli_fetch_all($runu, MYSQLI_ASSOC);
    return $totalVasTarget;
}
```

### `userVAStargetPer()`

```php
function userVAStargetPer($user_id)
{
    global $con;
    $quedates = AutoQueSystemDate();
    $dates = explode("/", $quedates);
    $start = $dates[0];
    $end = $dates[1];
    $query = "SELECT webxl_setterget.terget_cat,webxl_setterget.user_id,webxl_setterget.terget_id,webxl_setterget.start_date,webxl_setterget.end_date, 
    webxl_terget.terget_name,webxl_terget.target_number,webxl_terget.price,webxl_terget.conversion,webxl_terget.bonus,webxl_terget.max_amount,webxl_terget.type,webxl_terget.reward
    FROM webxl_setterget LEFT JOIN webxl_terget ON webxl_setterget.terget_id=webxl_terget.terget_id WHERE webxl_setterget.terget_cat='3' AND webxl_setterget.user_id = '$user_id' AND webxl_terget.type='new'
     AND  webxl_setterget.start_date >= '$start' AND webxl_setterget.end_date <= '$end'";
    $runu = mysqli_query($con, $query);
    $userABtarget = mysqli_fetch_all($runu, MYSQLI_ASSOC);
    return json_encode($userABtarget);
}
```

### `userMonthlyAchiveTarget50Kor100Kor150K2Inv()`

```php
function userMonthlyAchiveTarget50Kor100Kor150K2Inv($user_id, $start, $end)
{
    global $con;

    if ($user_id == 43) {
        $query = "
            SELECT 
                webxl_payments.com_id,
                webxl_payments.amount,
                webxl_payments.create_date,
                webxl_payments.invoice_id,
                SUM(webxl_payments.amount) AS TotalMonthVas,
                webxl_invoice.com_id,
                webxl_invoice.invoice_id,
                webxl_invoice.domain_renewal
            FROM webxl_payments
            LEFT JOIN webxl_invoice 
                ON (webxl_payments.com_id = webxl_invoice.com_id 
                AND webxl_payments.invoice_id = webxl_invoice.invoice_id)
            WHERE 
                webxl_invoice.user_id = '$user_id' 
                AND webxl_invoice.domain_renewal = 0
                AND DATE(webxl_payments.create_date) >= '$start' 
                AND DATE(webxl_payments.create_date) <= '$end'
            GROUP BY webxl_invoice.user_id
        ";
    } else {
        $query = "
            SELECT 
                webxl_payments.com_id,
                webxl_payments.amount,
                webxl_payments.create_date,
                webxl_payments.invoice_id,
                SUM(webxl_payments.amount) AS TotalMonthVas,
                webxl_invoice.com_id,
                webxl_invoice.invoice_id
            FROM webxl_payments
            LEFT JOIN webxl_invoice 
                ON (webxl_payments.com_id = webxl_invoice.com_id 
                AND webxl_payments.invoice_id = webxl_invoice.invoice_id)
            WHERE 
                webxl_invoice.user_id = '$user_id'
                AND DATE(webxl_payments.create_date) >= '$start' 
                AND DATE(webxl_payments.create_date) <= '$end'
            GROUP BY webxl_invoice.user_id
        ";
    }

    // 🧠 Debug line (prints the actual SQL query)
    // echo "<pre style='background:#111;color:#0f0;padding:10px;border-radius:6px;'>$query</pre>";

    $runu = mysqli_query($con, $query);

    if (!$runu) {
        echo "<p style='color:red;'>❌ Query Error: " . mysqli_error($con) . "</p>";
        return 0;
    }

    $rowu = mysqli_fetch_assoc($runu);
    $TotalMonthVas = $rowu['TotalMonthVas'] ?? 0;

    // echo "<p style='color:blue;'>✅ TotalMonthVas = " . $TotalMonthVas . "</p>";

    return $TotalMonthVas;
}
```

### `AllDuePaymentsPendingByUserByDate()`

```php
function AllDuePaymentsPendingByUserByDate($user_id, $start, $end)
{

    global $con;
    $npinv = 0;
    $total_padding = 0;
    $total_amount = 0;
    $grand_total = 0;
    $query = "SELECT * FROM webxl_invoice WHERE user_id='$user_id' AND DATE(create_date) BETWEEN '$start' AND '$end'  ORDER BY invoice_id DESC";
    $retval = mysqli_query($con, $query);
    $cot = mysqli_num_rows($retval);
    $row = mysqli_fetch_assoc($retval);

    do {
        $pay = $row['pay'];
        $invoice_id = $row['invoice_id'];
        $com_idIN = $row['com_id'];
        $gtotal = $row['grand_total'];
        $payMent = payMent($invoice_id);
        $payMentIn = $payMent['invoice_id'];
        $amount = $payMent['amount'];
        if ($invoice_id == $payMentIn && $pay != 0 && $pay != NULL) {
            $payed = round($gtotal - $row['pay'], 0);
            $total_padding = $total_padding + $payed;
            $total_amount = $total_amount + $payMent['amount'];
            $grand_total = $grand_total + $row['grand_total'];
            if ($payed > 100) {
                $npinv++;
            }
        }
    } while ($row = mysqli_fetch_assoc($retval));
    return $total_padding;
}
```

### `months_between_dates()`

```php
function months_between_dates($start_date, $end_date)
{
    $start = new DateTime($start_date);
    $end = new DateTime($end_date);

    $months = array();

    while ($start < $end) {
        $months[] = $start->format('Y-m');
        $start->modify('+1 month');
    }

    return $months;
}
```

### `comData()`

```php
function comData($com_id)
{  // get company Data
    global $con;
    $quryu = "SELECT * FROM webxl_company WHERE id = '$com_id'";
    $runu = mysqli_query($con, $quryu);
    $rowu = mysqli_fetch_assoc($runu);
    return $rowu;
}
```

### `payInvoice()`

```php
function payInvoice($invoice)
{  // get user name
    global $con;
    $quryu = "SELECT * FROM webxl_invoice WHERE invoice_id = '$invoice'";
    $runu = mysqli_query($con, $quryu);
    $rowu = mysqli_fetch_assoc($runu);
    return $rowu;
}
```

### `ITDashDomainsDetail()`

```php
function ITDashDomainsDetail($com_id)
{
    global $con;
    $query = "SELECT webxl_sell.id,webxl_sell.com_id,webxl_sell.domain_name,webxl_sell.reg_date FROM webxl_sell WHERE webxl_sell.com_id='$com_id'";
    $runu = mysqli_query($con, $query);
    $cot = mysqli_num_rows($runu);
    if ($cot > 0) {
        $rowu = mysqli_fetch_assoc($runu);
        return $rowu;
    }
}
```

---

## 5. Initial review notes (observations, not code changes)

- The VAS Payment Report query selects all rows from `webxl_payments`, then filters by date in PHP. Consider whether date filtering can safely be moved into SQL after confirming intended semantics.
- The Payment Report appears to label `webxl_payments` rows as `New`/`Renewal` using `payInvoice()` and separately calls `ITDashDomainsDetail()` to derive another renewal label (`$domain_renewal0`), but the latter value does not appear in the displayed table in this branch.
- The all-users commission report uses hard-coded thresholds: 1,000–49,999 => 10% and no reward; 50,000–99,999 => 15% + 2,500 reward; 100,000–149,999 => 15% + 5,000 reward; 150,000+ => 15% + 8,000 reward. Confirm these are intended business rules before modifying.
- The month-wise report uses target rows returned by `userVAStargetPer()` and applies `conversion` percentage plus `reward`. Check whether target ranges can overlap or have gaps, and whether date range/month boundary handling is correct.
- SQL uses variables interpolated into queries in several helper functions. Review input validation and prepared statements before production changes.
- The source uses legacy spellings/names such as `Vas-Comission`, `terget`, and `month_waise`; preserve these when locating existing UI/API calls, but do not rename without checking callers.
- The report code depends on a shared `$con` MySQLi connection and existing helper functions. This extract intentionally does not include database credentials or the entire application bootstrap.
