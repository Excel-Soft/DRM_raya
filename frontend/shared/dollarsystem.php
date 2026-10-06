<style>
    table:hover td.sticky-td {
        position: sticky !important;
        top: 0 !important;
        left: 0 !important;
        background: aliceblue !important;
    }
</style>
<?php
if (!function_exists('cash_in_hand_gm_customer_dollars')) {
    function cash_in_hand_gm_customer_dollars($type = '') { return 0; }
}
if (!function_exists('buyer_dollar_pay_pending_extra_disc_pkr')) {
    function buyer_dollar_pay_pending_extra_disc_pkr() { return 0; }
}
if (!function_exists('AutoQueSystemDate')) {
    function AutoQueSystemDate() { return date('Y-01-01/Y-12-31'); }
}
if (!function_exists('getLastQuarterDates')) {
    function getLastQuarterDates($date) { return ['start' => date('Y-01-01'), 'end' => date('Y-12-31')]; }
}
if (!function_exists('allChequesRemainPkrByTypeDATEWaiseLastQue')) {
    function allChequesRemainPkrByTypeDATEWaiseLastQue($a, $b, $c, $d, $e) { return 0; }
}
if (!function_exists('cash_in_hand_gm_pkr')) {
    function cash_in_hand_gm_pkr($type = '') { return 0; }
}
if (!function_exists('partial_cash_in_hand_gm_dollars')) {
    function partial_cash_in_hand_gm_dollars($type = '') { return 0; }
}
if (!function_exists('partial_cash_in_hand_gm_pkr')) {
    function partial_cash_in_hand_gm_pkr($type = '') { return 0; }
}
if (!function_exists('buyer_dollar_pay_pending_extra_disc')) {
    function buyer_dollar_pay_pending_extra_disc() { return 0; }
}
$quedates = AutoQueSystemDate();
$dates = explode("/", $quedates);
$start = $dates[0];
$end = $dates[1];
$current_date = date('Y-m-d');
$getLastQuarterDates = getLastQuarterDates($current_date);
$LastQueStart = $getLastQuarterDates['start'];
$LastQueEnd = $getLastQuarterDates['end'];
$manuall_last_quarter_closing = number_format(allChequesRemainPkrByTypeDATEWaiseLastQue('Closing', 'used', 'quarter', $start, $end));
?>

<!-- Material Design Icons -->
<link href="https://cdnjs.cloudflare.com/ajax/libs/MaterialDesign-Webfont/7.0.96/css/materialdesignicons.min.css"
    rel="stylesheet">
<!-- SheetJS for Excel export --></div>
<div class="main-content">
    <div class="page-content">
        <div class="container-fluid">
            <div class="row">
                <div class="col-12">
                    <div class="page-title-box d-sm-flex align-items-center justify-content-between">
                        <h4 class="mb-sm-0 font-size-18">WALLETS </h4>

                    </div>
                </div>
            </div>
            <div class="row" id="fullPage">
                <div class="col-xl-4">
                    <div class="card">
                        <div class="card-body border-top">

                            <div class="row">
                                <div class="col-sm-6">
                                    <div>
                                        <p class="text-info font-size-10"><?= $start ?> To <?= $end ?></p>
                                        <p class="text-muted mb-2 card-title">Available Balance </p>
                                        <h5>C $ <?= round(buyer_total_dollar($start, $end), 2) ?></h5>
                                        <span class="font-size-14 text-muted">PKR
                                            <?= round(buyer_total_pkr_amount($start, $end), 2) ?></span>
                                        <h5>L $ <?= round(buyer_total_dollar($LastQueStart, $LastQueEnd), 2) ?></h5>
                                        <span class="font-size-14 text-muted">PKR
                                            <?= round(buyer_total_pkr_amount($LastQueStart, $LastQueEnd), 2) ?></span>
                                    </div>
                                    <div class="mt-2">
                                        <p class="text-muted mb-2 card-title">Required Balance To Pay</p>
                                        <h5>$
                                            <?= round(webxl_required_dollars_to_pay() + webxl_required_dollars_to_pay_full_payment(), 2) ?>
                                        </h5>

                                    </div>
                                    <div class="mt-2">
                                        <p class="text-muted mb-2 card-title">Cash In Hand</p>
                                        <h5>PKR
                                            <?= number_format(round((round((cash_in_hand_gm_pkr_all_over_All_cash_in_hand('Cash Received', $start, $end) + cash_in_hand_gm_pkr_all_over_All_cash_in_hand('Online Paid', $start, $end)), 2) +
                                                round((partial_cash_in_hand_gm_pkr_by_date_cash_in_han('Cash Received', $start, $end) + partial_cash_in_hand_gm_pkr_by_date_cash_in_han('Online Paid', $start, $end)), 2) +
                                                round((partial_cash_in_hand_gm_pkr_by_date('Cash Received', $start, $end)), 2) + round((partial_cash_in_hand_gm_pkr_by_date('Online Paid', $start, $end)), 2)), 0)
                                                + round(allChequesRemainPkrByTypeDATEWaise('For Dollar', 'used', 'no', $start, $end), 0)
                                                + allChequesRemainPkrByTypeDATEWaise('Recovery', 'used', 'no', $start, $end)
                                                + str_replace(',', '', $manuall_last_quarter_closing) - round(buyer_total_pkr_amount_received_history($start, $end), 0)) ?>
                                        </h5>

                                    </div>

                                </div>
                                <div class="col-sm-6">
                                    <div class="text-sm-end clearfix mt-4 mt-sm-0">
                                        <div class="float-end">
                                            <div class="input-group input-group-sm">
                                                <select class="form-select form-select-sm" id="AccountdashHead">
                                                    <option value="CQ" selected="">Current Q</option>
                                                    <option value="LQ">Last Q</option>
                                                    <option value="LS">Last S</option>
                                                    <option value="LY">Last Y</option>
                                                </select>
                                            </div>
                                        </div>
                                        <!-- <p class="text-muted mb-2">Since last month</p>
                                                    <h5>+ $ <?= round((buyer_total_dollar_current_month() - buyer_total_dollar_current_last_month()), 2) ?>   <span class="badge bg-success ms-1 align-bottom">+ <?= round((buyer_total_dollar_current_last_month() / buyer_total_dollar_current_month()) * 100, 2) ?> %</span></h5> -->

                                    </div>
                                    <div class="text-sm-end mt-4 mt-sm-0">
                                        <p class="text-muted mb-2">Dollars Recovery</p>
                                        <a href="recovery-payments=dollars-recovery" target="_blank">
                                            <h5> $ <?= round(webxl_recover_dollars(), 2) ?> </h5>
                                        </a>

                                    </div>
                                    <div class="text-sm-end mt-4 mt-sm-0">
                                        <p class="text-muted mb-2">Cash Recovery</p>
                                        <a href="recovery-payments=cash-recovery" target="_blank">
                                            <h5> PKR <?= round(webxl_recover_dollars_pkr(), 2) ?> </h5>
                                        </a>

                                    </div>
                                    <div class="text-sm-end mt-4 mt-sm-0">
                                        <p class="text-muted mb-2">Partial Dollars Recovery</p>
                                        <a href="recovery-payments=installment-recovery" target="_blank">
                                            <h5> $ <?= round(webxl_required_dollars_company(), 2) ?> </h5>
                                        </a>

                                    </div>
                                </div>
                                <div class="col-md-12 d-flex justify-content-between">
                                    <div class="mt-2">
                                        <p class="text-success mb-2 card-title">Cash Recovered</p>
                                        <h5>PKR <?= round(webxl_recoverd_dollars_pkr(), 2) ?></h5>

                                    </div>
                                    <div class="mt-2">
                                        <p class="text-success mb-2 card-title">Dollar Recovered</p>
                                        <h5>$ <?= round(webxl_recoverd_dollars(), 2) ?></h5>

                                    </div>
                                </div>

                            </div>
                        </div>

                        <div class="card-body border-top">
                            <p class="text-muted mb-1">In this month usage</p>
                            <div class="text-center">
                                <div class="row">

                                    <div class="col-sm-3">
                                        <div class="mt-4 mt-sm-0">
                                            <div class="font-size-24 text-primary mb-2">
                                                <i class="bx bx-import"></i>
                                            </div>

                                            <p class="text-muted mb-2">Dollar Buying</p>
                                            <h5>$ <?= round(buyer_total_dollar_current_month(), 2) ?></h5>
                                            <?php if ($user_id != 37) { ?>
                                                <div class="mt-3">
                                                    <a href="dollar-buy" target="_blank"
                                                        class="btn btn-primary btn-sm w-md">Receive</a>
                                                </div>
                                            <?php } ?>
                                        </div>
                                    </div>
                                    <div class="col-sm-3">
                                        <div>
                                            <div class="font-size-24 text-primary mb-2">
                                                <i class="bx bx-send"></i>
                                            </div>

                                            <p class="text-muted mb-2">Dollar Paid</p>
                                            <h5>$ <?= buyer_dollar_pay_current_month_dollars() ?></h5>
                                            <?php if ($user_id != 37) { ?>
                                                <div class="mt-3">
                                                    <a href="dollar-pay" target="_blank"
                                                        class="btn btn-primary btn-sm w-md">Send</a>
                                                </div>
                                            <?php } ?>
                                        </div>
                                    </div>

                                    <div class="col-sm-3">
                                        <div class="mt-4 mt-sm-0">
                                            <div class="font-size-24 text-primary mb-2">
                                                <i class="bx bx-wallet"></i>
                                            </div>

                                            <p class="text-muted mb-2">Dollar Balance</p>
                                            <h5>$
                                                <?= round((buyer_total_dollar_current_month() - buyer_dollar_pay_current_month_dollars()), 2) ?>
                                            </h5>
                                            <?php if ($user_id != 37) { ?>
                                                <div class="mt-3">
                                                    <a href="javascript:void(0)"
                                                        class="btn btn-primary btn-sm w-md">Balance</a>
                                                </div>
                                            <?php } ?>
                                        </div>
                                    </div>
                                    <div class="col-sm-3">
                                        <div class="mt-4 mt-sm-0">
                                            <div class="font-size-24 text-primary mb-2">
                                                <i class="bx bx-wallet-alt"></i>
                                            </div>

                                            <p class="text-muted mb-2">Advance Pay</p>

                                            <h5>PKR
                                                <?= number_format(round(webxl_dollar_advance_pay(date('Y-m-1'), date('Y-m-t')), 0)) ?>
                                            </h5>
                                            <?php if ($user_id != 37) { ?>
                                                <div class="mt-3">
                                                    <a href="advance-pay" target="_blank"
                                                        class="btn btn-primary btn-sm w-md">Advance Pay</a>
                                                </div>
                                            <?php } ?>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                    <div class="card" id="fullPage2">
                        <div class="card-body">
                            <h4 class="card-title mb-4">Current Day Transactions</h4>

                            <ul class="nav nav-pills bg-light rounded" role="tablist">
                                <li class="nav-item">
                                    <a class="nav-link active" data-bs-toggle="tab"
                                        href="#transactions-buy-tab-show_balance" role="tab">Balance <span
                                            class="badge rounded-pill bg-secondary float-end  mx-1"><?= COUNT(json_decode(buyer_dollar_ab_not_show_balance())) ?>(<?= round(buyer_total_dollar($start, $end), 2) + round(buyer_total_dollar($LastQueStart, $LastQueEnd), 2) ?>)</span></a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link " data-bs-toggle="tab" href="#transactions-buy-tab"
                                        role="tab">Buy <span
                                            class="badge rounded-pill bg-success float-end  mx-1"><?= COUNT(json_decode(buyer_dollar_current_month_day())) ?>(<?= round(buyer_total_dollar_current_month_day(), 0) ?>)</span></a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" data-bs-toggle="tab" href="#transactions-sell-tab"
                                        role="tab">Sell <span
                                            class="badge rounded-pill bg-danger float-end  mx-1"><?= COUNT(json_decode(buyer_dollar_pay_current_month_day())) ?>(<?= buyer_dollar_pay_current_month_dollars_day() ?>)</span></a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" data-bs-toggle="tab" href="#transactions-buy-tab-not-show"
                                        role="tab">Martini <span
                                            class="badge rounded-pill bg-info float-end  mx-1"><?= COUNT(json_decode(buyer_dollar_ab_not_show())) ?>(<?= round(buyer_dollar_ab_not_show_amount(), 2) ?>)</span></a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" data-bs-toggle="tab" href="#transactions-buy-tab-not-used"
                                        role="tab">Not Used <span
                                            class="badge rounded-pill bg-info float-end  mx-1"><?= COUNT(json_decode(buyer_dollar_ab_not_used())) ?>(<?= round(buyer_dollar_ab_not_show_amount_not_used(), 2) ?>)</span></a>
                                </li>

                            </ul>
                            <div class="tab-content mt-4">
                                <div class="tab-pane " data-simplebar style="max-height: 530px;"
                                    id="transactions-buy-tab" role="tabpanel">
                                    <div class="table-responsive">
                                        <table class="table align-middle table-nowrap">
                                            <tbody>
                                                <?php
                                                $companies = json_decode(buyer_dollar_current_month_day());
                                                foreach ($companies as $list) {

                                                ?>

                                                    <tr>
                                                        <td>
                                                            <div class="font-size-22 text-primary">
                                                                <i class="bx bx-down-arrow-circle"></i>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div>
                                                                <h5 class="font-size-14 mb-1">
                                                                    <?= username($list->buyer_main) ?>
                                                                </h5>
                                                                <p class="text-muted mb-0">
                                                                    <?= date('d M Y', strtotime($list->buy_date)) ?>
                                                                </p>
                                                                <p class="text-muted mb-0">
                                                                    <?= $list->buyer_reference_paypal_email ?>
                                                                </p>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 mb-0"><?= $list->dollar_rate ?></h5>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 text-muted mb-0">$
                                                                    <?= $list->dollars ?>
                                                                </h5>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                <?php } ?>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div class="tab-pane" id="transactions-sell-tab" role="tabpanel" data-simplebar
                                    style="max-height: 530px;">
                                    <div class="table-responsive">
                                        <table class="table align-middle table-nowrap">
                                            <tbody>
                                                <?php
                                                $companies0 = json_decode(buyer_dollar_pay_current_month_day());
                                                foreach ($companies0 as $list0) {

                                                ?>

                                                    <tr>
                                                        <td>
                                                            <div class="font-size-22 text-danger">
                                                                <i class="bx bx-down-arrow-circle"></i>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div>
                                                                <h5 class="font-size-14 mb-1"><?= comname($list0->com_id) ?>
                                                                </h5>
                                                                <p class="text-muted mb-0">
                                                                    <?= date('d M Y', strtotime($list0->pay_date)) ?>
                                                                </p>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 mb-0"><?= $list0->dollar_rate ?>
                                                                </h5>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 text-muted mb-0">$
                                                                    <?= $list0->dollars ?>
                                                                </h5>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                <?php } ?>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div class="tab-pane" data-simplebar style="max-height: 530px;"
                                    id="transactions-buy-tab-not-show" role="tabpanel">
                                    <div class="table-responsive">
                                        <table class="table align-middle table-nowrap">
                                            <tbody>
                                                <?php
                                                $companies = json_decode(buyer_dollar_ab_not_show());
                                                foreach ($companies as $list) {

                                                ?>

                                                    <tr>
                                                        <td>
                                                            <div class="font-size-22 text-warning">
                                                                <i class="bx bx-up-arrow-circle"></i>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div>
                                                                <h5 class="font-size-14 mb-1">
                                                                    <?= username($list->buyer_main) ?>
                                                                </h5>
                                                                <p class="text-muted mb-0">
                                                                    <?= date('d M Y', strtotime($list->buy_date)) ?>
                                                                </p>
                                                                <p class="text-muted mb-0">
                                                                    <?= $list->buyer_reference_paypal_email ?>
                                                                </p>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 mb-0"><?= $list->dollar_rate ?></h5>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 text-muted mb-0">$
                                                                    <?= $list->dollars ?>
                                                                </h5>

                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div class="text-end">
                                                                <a href="./assets/images/dollar_screenshot/<?= $list->screen_shot ?>"
                                                                    target="_blank" class="text-success"><i
                                                                        class="bx bx-show font-size-20"></i></a>
                                                                <h5 class="font-size-14 text-muted mb-0"><a
                                                                        href="javascript:void(0)"
                                                                        onclick="ShowDollarsAb('<?= username($list->buyer_main) ?>','<?= $list->buyer_reference_paypal_email ?>','<?= $list->id ?>','<?= $list->dollar_slot_id ?>')"
                                                                        data-bs-toggle="modal"
                                                                        data-bs-target=".orderdetailsModal3NotShow">
                                                                        <button type="button"
                                                                            style="height:1.5rem; width:1.5rem;"
                                                                            class="btn btn-primary position-relative p-0 avatar-xs rounded-circle"
                                                                            title="Show Payment"><span
                                                                                class="avatar-title bg-transparent text-reset"><i
                                                                                    class="bx bxs-edit"></i></span></button></a>
                                                                </h5>
                                                            </div>
                                                        </td>

                                                    </tr>
                                                <?php } ?>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="tab-pane" data-simplebar style="max-height: 530px;"
                                    id="transactions-buy-tab-not-used" role="tabpanel">
                                    <div class="table-responsive">
                                        <table class="table align-middle table-nowrap">
                                            <tbody>
                                                <?php
                                                $companies = json_decode(buyer_dollar_ab_not_used());
                                                foreach ($companies as $list) {

                                                ?>

                                                    <tr>
                                                        <td>
                                                            <div class="font-size-22 text-warning">
                                                                <i class="bx bx-up-arrow-circle"></i>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div>
                                                                <h5 class="font-size-14 mb-1">
                                                                    <?= username($list->buyer_main) ?>
                                                                </h5>
                                                                <p class="text-muted mb-0">
                                                                    <?= date('d M Y', strtotime($list->buy_date)) ?>
                                                                </p>
                                                                <p class="text-muted mb-0">
                                                                    <?= $list->buyer_reference_paypal_email ?>
                                                                </p>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 mb-0"><?= $list->dollar_rate ?></h5>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 text-muted mb-0">$
                                                                    <?= $list->dollars ?>
                                                                </h5>

                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div class="text-end">
                                                                <a href="./assets/images/dollar_screenshot/<?= $list->screen_shot ?>"
                                                                    target="_blank" class="text-success"><i
                                                                        class="bx bx-show font-size-20"></i></a>
                                                                <h5 class="font-size-14 text-muted mb-0"><a
                                                                        href="javascript:void(0)"
                                                                        onclick="ShowDollarsAb('<?= username($list->buyer_main) ?>','<?= $list->buyer_reference_paypal_email ?>','<?= $list->id ?>','<?= $list->dollar_slot_id ?>')"
                                                                        data-bs-toggle="modal"
                                                                        data-bs-target=".orderdetailsModal3NotShow">
                                                                        <button type="button"
                                                                            style="height:1.5rem; width:1.5rem;"
                                                                            class="btn btn-primary position-relative p-0 avatar-xs rounded-circle"
                                                                            title="Show Payment"><span
                                                                                class="avatar-title bg-transparent text-reset"><i
                                                                                    class="bx bxs-edit"></i></span></button></a>
                                                                </h5>
                                                            </div>
                                                        </td>

                                                    </tr>
                                                <?php } ?>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div class="tab-pane active" data-simplebar style="max-height: 530px;"
                                    id="transactions-buy-tab-show_balance" role="tabpanel">
                                    <div class="table-responsive">
                                        <table class="table align-middle table-nowrap">
                                            <tbody>
                                                <?php
                                                $companies = json_decode(buyer_dollar_ab_not_show_balance());
                                                foreach ($companies as $list) {

                                                ?>

                                                    <tr>
                                                        <td>
                                                            <div class="font-size-22 text-warning">
                                                                <i class="bx bx-up-arrow-circle"></i>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div>
                                                                <h5 class="font-size-14 mb-1">
                                                                    <?= username($list->buyer_main) ?>
                                                                </h5>
                                                                <p class="text-muted mb-0">
                                                                    <?= date('d M Y', strtotime($list->buy_date)) ?>
                                                                </p>
                                                                <p class="text-muted mb-0">
                                                                    <?= $list->buyer_reference_paypal_email ?>
                                                                </p>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 mb-0"><?= $list->dollar_rate ?></h5>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div class="text-end">
                                                                <h5 class="font-size-14 text-muted mb-0">$
                                                                    <?= $list->dollars ?>
                                                                </h5>

                                                            </div>
                                                        </td>

                                                    </tr>
                                                <?php } ?>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    <!-- <div class="card">
                        <div class="card-body">
                            <h4 class="card-title mb-4">Rejected Partial Payments</h4>
                            <div data-simplebar style="max-height: 330px;">
                                <div class="table-responsive">
                                    <table class="table align-middle table-nowrap">
                                        <tbody>
                                            <?php
                                            $rej_query = "SELECT * FROM webxl_verify_gm WHERE alibaba='Pending' AND webxl_behalf='Installment' AND acc_disc_status = 'Rejected' ORDER BY `id` DESC";
                                            $rej_retval = mysqli_query($con, $rej_query);
                                            if (mysqli_num_rows($rej_retval) > 0) {
                                                while ($rej_row = mysqli_fetch_assoc($rej_retval)) {
                                            ?>
                                                <tr>
                                                    <td>
                                                        <div class="font-size-22 text-danger">
                                                            <i class="bx bx-x-circle"></i>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div>
                                                            <h5 class="font-size-14 mb-1">
                                                                <?= comname($rej_row['com_id']) ?>
                                                            </h5>
                                                            <p class="text-muted mb-0">
                                                                <?= date('d M Y', strtotime($rej_row['create_request'])) ?>
                                                            </p>
                                                            <p class="text-muted mb-0">
                                                                <?= username($rej_row['user_id']) ?>
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div class="text-end">
                                                            <h5 class="font-size-14 mb-0"><?= $rej_row['dollar_rate'] ?></h5>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div class="text-end">
                                                            <h5 class="font-size-14 text-muted mb-0">$
                                                                <?= $rej_row['price'] ?>
                                                            </h5>
                                                            <h5 class="font-size-12 text-muted mb-0">PKR
                                                                <?= $rej_row['amount'] ?>
                                                            </h5>
                                                        </div>
                                                    </td>
                                                </tr>
                                            <?php
                                                }
                                            } else {
                                                echo '<tr><td colspan="4" class="text-center text-muted">No rejected records found</td></tr>';
                                            }
                                            ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div> -->
                </div>

                <div class="col-xl-8">
                    <ul class="nav nav-pills bg-light rounded" role="tablist">
                        <li class="nav-item">
                            <a class="nav-link active" data-bs-toggle="tab" href="#full_payment_tab" role="tab">Full
                                <span class="nav-link font-size-14" id="TotalFullNumBtnTab"
                                    style="display: contents !important;"></span></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-bs-toggle="tab" href="#partial_payment_tab" role="tab">Partial
                                <span class=" nav-link font-size-14" id="TotalPartNumTab"
                                    style="display: contents !important;"></span></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-bs-toggle="tab" href="#temp_payment_tab" role="tab">Tem Payment
                                <span class=" nav-link font-size-14" id="TotalPartNumTabTemp"
                                    style="display: contents !important;"></span></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-bs-toggle="tab" href="#ab_liabilities_tab" role="tab">AB
                                Liabilities
                                <span class=" nav-link font-size-14" id="TotalabLiabilitiesNumTabTemp"
                                    style="display: contents !important;"></span></a>
                        </li>
                    </ul>

                    <!----- Tab Start ----->
                    <div class="tab-content ">
                        <div class="tab-pane active" id="full_payment_tab" role="tabpanel">
                            <div class="card">


                                <div class="card">
                                    <div class="card-body">
                                        <h4 class="card-title mb-3">
                                            Full Payment Received <span
                                                class="text-danger font-size-14" id="TotalFullNum"></span>       Cash
                                            Received <span class="badge badge-pill badge-soft-success font-size-11">$
                                                <?= cash_in_hand_gm_dollars('Cash Received') ?>
                                            </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                                <?= round(cash_in_hand_gm_pkr('Cash Received')) ?>
                                            </span>        Online Paid <span
                                                class="badge badge-pill badge-soft-success font-size-11">$
                                                <?= cash_in_hand_gm_dollars('Online Paid') ?>
                                            </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                                <?= round(cash_in_hand_gm_pkr('Online Paid')) ?>
                                            </span>       Customer Paid <span
                                                class="badge badge-pill badge-soft-success font-size-11">$
                                                <?= cash_in_hand_gm_dollars('Customer Paid') ?>
                                            </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                                <?= round(cash_in_hand_gm_pkr('Customer Paid')) ?>
                                            </span>
                                            &nbsp;&nbsp;&nbsp; NC(<span class="text-success font-size-11 "
                                                id="NC"></span>) &nbsp;&nbsp;&nbsp; RC(<span
                                                class="text-info font-size-11" id="RC"></span>) &nbsp;&nbsp;&nbsp;
                                            EC(<span class="text-danger font-size-11" id="EC"></span>)</h4>
                                        <div class="row">
                                            <div class="col-12">
                                                <div>
                                                    <div>
                                                        <div class="row mb-2">
                                                            <div class="col-sm-3">
                                                                <div class="search-box me-2 mb-2 d-inline-block w-100">
                                                                    <div class="position-relative">
                                                                        <input type="text" id="searchInput"
                                                                            class="form-control"
                                                                            placeholder="Search...">
                                                                        <i class="bx bx-search-alt search-icon"></i>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div class="col-sm-3">
                                                                <input type="date" id="fromDate"
                                                                    class="form-control mb-2" placeholder="From Date">
                                                            </div>

                                                            <div class="col-sm-3">
                                                                <input type="date" id="toDate" class="form-control mb-2"
                                                                    placeholder="To Date">
                                                            </div>

                                                            <div class="col-sm-3">
                                                                <button type="button" id="clearFilter"
                                                                    class="btn btn-sm btn-secondary mb-2">
                                                                    Clear Filter
                                                                </button>
                                                                <button type="button" class="btn btn-sm btn-success mb-2" onclick="exportFullPaymentToExcel()">
                                                                    <i class="bx bx-download me-1"></i>Export to Excel
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <script>
                                                            function exportFullPaymentToExcel() {
                                                                try {
                                                                    if (typeof XLSX === 'undefined') {
                                                                        alert('Excel export library is not loaded.');
                                                                        return;
                                                                    }
                                                                    const btn = event.currentTarget;
                                                                    const originalHtml = btn.innerHTML;
                                                                    btn.innerHTML = '<i class="bx bx-loader bx-spin me-1"></i>Exporting...';
                                                                    btn.disabled = true;

                                                                    const search = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
                                                                    const fromDate = document.getElementById('fromDate') ? document.getElementById('fromDate').value : '';
                                                                    const toDate = document.getElementById('toDate') ? document.getElementById('toDate').value : '';

                                                                    $.ajax({
                                                                        url: 'layouts/func.php',
                                                                        type: 'POST',
                                                                        data: {
                                                                            export_all_data_full: true,
                                                                            search: search,
                                                                            fromDate: fromDate,
                                                                            toDate: toDate
                                                                        },
                                                                        dataType: 'json',
                                                                        success: function(data) {
                                                                            btn.innerHTML = originalHtml;
                                                                            btn.disabled = false;

                                                                            if (data.records && data.records.length > 0) {
                                                                                const excelData = [];
                                                                                const headers = ['S.No', 'Drm Id', 'Member Id', 'Order Id', 'Company', 'Person', 'Package', 'Type', 'Dollar', 'Cus Dollar', 'Dollar Rate', 'Pkr', 'Ex-Disc', 'Ex-Disc Pkr', 'Status', 'Acc Pay Status', 'Create Date', 'Accountant', 'HOD', 'Pay Date'];
                                                                                excelData.push(headers);

                                                                                let n = 1;
                                                                                data.records.forEach(row => {
                                                                                    let renwal = '';
                                                                                    if (row.renwal == 1) renwal = 'New';
                                                                                    else if (row.renwal == 0) renwal = 'Rc';
                                                                                    else if (row.renwal == 2) renwal = 'Ec';
                                                                                    else if (row.renwal == 3) renwal = 'Rc-Up';
                                                                                    else renwal = 'None';

                                                                                    let price = row.acc_pay_status == 'Customer Paid' ? row.extra_discount : row.price;
                                                                                    let amount = row.acc_pay_status == 'Customer Paid' ? row.extra_pkr_discount : row.amount;

                                                                                    excelData.push([
                                                                                        n++,
                                                                                        row.com_id || '',
                                                                                        row.member_id || '',
                                                                                        row.order_id || '',
                                                                                        row.cname || '',
                                                                                        row.name || '',
                                                                                        row.package || '',
                                                                                        renwal,
                                                                                        price || '',
                                                                                        row.customer_dollars || '',
                                                                                        row.dollar_rate || '',
                                                                                        amount || '',
                                                                                        row.extra_discount || '',
                                                                                        row.extra_pkr_discount || '',
                                                                                        row.status || '',
                                                                                        row.acc_pay_status || '',
                                                                                        row.create_date ? new Date(row.create_date).toISOString().slice(0, 10) : '',
                                                                                        row.acc_disc_status || '',
                                                                                        row.ceo_disc_status || '',
                                                                                        row.pay_date ? new Date(row.pay_date).toISOString().slice(0, 10) : ''
                                                                                    ]);
                                                                                });

                                                                                const wb = XLSX.utils.book_new();
                                                                                const ws = XLSX.utils.aoa_to_sheet(excelData);
                                                                                XLSX.utils.book_append_sheet(wb, ws, "Full Payment");
                                                                                XLSX.writeFile(wb, "full_payment_" + new Date().toISOString().slice(0, 10) + ".xlsx");
                                                                            } else {
                                                                                alert("No data available to export!");
                                                                            }
                                                                        },
                                                                        error: function(e) {
                                                                            btn.innerHTML = originalHtml;
                                                                            btn.disabled = false;
                                                                            console.error(e);
                                                                            alert("Error exporting data.");
                                                                        }
                                                                    });
                                                                } catch (e) {
                                                                    console.error(e);
                                                                    alert('Error occurred while exporting.');
                                                                }
                                                            }
                                                        </script>

                                                        <div class="table-responsive border-0">
                                                            <table class="table table-sm align-middle table-nowrap">
                                                                <thead>
                                                                    <tr>
                                                                        <th>#</th>
                                                                        <th>Drm id</th>
                                                                        <th>Created Date</th>
                                                                        <th>Company</th>
                                                                        <th>Sale Person</th>
                                                                        <th>Dollar</th>
                                                                        <th>Cus Dollar</th>
                                                                        <th>Pkr</th>
                                                                        <th>Dollar Rate</th>
                                                                        <th>Ex-Disc</th>
                                                                        <th>Ex-Disc Pkr</th>
                                                                        <th>Package</th>
                                                                        <th>Type</th>
                                                                        <th>Expire</th>
                                                                        <th>Droupout</th>
                                                                        <th>Status</th>
                                                                        <th>Action</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody id="showdata">

                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        <ul
                                                            class="pagination pagination-rounded justify-content-end mb-2">
                                                            <li class="page-item ">
                                                                <a class="page-link" href="javascript: void(0);"
                                                                    aria-label="Previous" id="prevPage">
                                                                    <i class="mdi mdi-chevron-left"></i>
                                                                </a>
                                                            </li>
                                                            <span class="d-flex" id="pageNumbers"></span>
                                                            <li class="page-item">
                                                                <a class="page-link" href="javascript: void(0);"
                                                                    aria-label="Next" id="nextPage">
                                                                    <i class="mdi mdi-chevron-right"></i>
                                                                </a>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- end row -->
                                    </div>
                                </div>

                            </div>
                        </div>

                        <div class="tab-pane " id="partial_payment_tab" role="tabpanel">
                            <div class="card">
                                <div class="card-body">
                                    <h4 class="card-title mb-3">Partial Full Payment Received  <span
                                            class="text-danger font-size-14" id="TotalPartialNum_tab"></span>     Cash
                                        Received <span class="badge badge-pill badge-soft-success font-size-11">$
                                            <?= round(partial_cash_in_hand_gm_dollars('Cash Received'), 2) ?></span>
                                        <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                            <?= round(partial_cash_in_hand_gm_pkr('Cash Received'), 2) ?></span>
                                        Extra Discount <span class="badge badge-pill badge-soft-success font-size-11">$
                                            <?= round(partial_cash_in_hand_gm_dollars('Extra Discount Paid'), 2) ?></span>
                                        <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                            <?= round(partial_cash_in_hand_gm_pkr('Extra Discount Paid'), 2) ?></span>
                                        Online Paid <span class="badge badge-pill badge-soft-success font-size-11">$
                                            <?= partial_cash_in_hand_gm_dollars('Online Paid') ?></span> <span
                                            class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                            <?= partial_cash_in_hand_gm_pkr('Online Paid') ?></span>     Customer Paid
                                        <span class="badge badge-pill badge-soft-success font-size-11">$
                                            <?= partial_cash_in_hand_gm_dollars('Customer Paid') ?></span> <span
                                            class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                            <?= partial_cash_in_hand_gm_pkr('Customer Paid') ?></span>
                                    </h4>
                                    <div class="row">
                                        <?php
                                        $partialFromDate = isset($_GET['partial_from_date']) ? $_GET['partial_from_date'] : '';
                                        $partialToDate = isset($_GET['partial_to_date']) ? $_GET['partial_to_date'] : '';

                                        $dateFilter = "";
                                        if (!empty($partialFromDate) && !empty($partialToDate)) {
                                            $dateFilter = " AND DATE(g.create_request) BETWEEN '$partialFromDate' AND '$partialToDate' ";
                                        } elseif (!empty($partialFromDate)) {
                                            $dateFilter = " AND DATE(g.create_request) >= '$partialFromDate' ";
                                        } elseif (!empty($partialToDate)) {
                                            $dateFilter = " AND DATE(g.create_request) <= '$partialToDate' ";
                                        }
                                        ?>
                                        <div class="row mb-3">
                                            <div class="col-md-3">
                                                <input type="date" id="partialFromDate" class="form-control"
                                                    value="<?= isset($_GET['partial_from_date']) ? $_GET['partial_from_date'] : '' ?>">
                                            </div>
                                            <div class="col-md-3">
                                                <input type="date" id="partialToDate" class="form-control"
                                                    value="<?= isset($_GET['partial_to_date']) ? $_GET['partial_to_date'] : '' ?>">
                                            </div>
                                            <div class="col-md-3">
                                                <button type="button" class="btn btn-sm btn-primary"
                                                    id="filterPartialDate">Filter</button>
                                                <button type="button" class="btn btn-sm btn-secondary"
                                                    id="clearPartialDate">Clear</button>
                                                <button type="button" class="btn btn-sm btn-success"
                                                    onclick="exportPartialPaymentToExcel()">
                                                    <i class="bx bx-download me-1"></i>Export to Excel
                                                </button>
                                            </div>
                                        </div>

                                        <script>
                                            function exportPartialPaymentToExcel() {
                                                try {
                                                    // Check if XLSX is available
                                                    if (typeof XLSX === 'undefined') {
                                                        alert('Excel export library is not loaded. Please try again later.');
                                                        return;
                                                    }

                                                    const btn = event.currentTarget;
                                                    const originalHtml = btn.innerHTML;
                                                    btn.innerHTML = '<i class="bx bx-loader bx-spin me-1"></i>Exporting...';
                                                    btn.disabled = true;

                                                    setTimeout(() => {
                                                        try {
                                                            const table = document.getElementById('datatable');
                                                            const wb = XLSX.utils.table_to_book(table, {
                                                                sheet: "Partial Payment"
                                                            });

                                                            const fileName = "partial_payment_" + new Date().toISOString().slice(0, 10) + ".xlsx";
                                                            XLSX.writeFile(wb, fileName);
                                                        } catch (e) {
                                                            console.error('Export error:', e);
                                                            alert('An error occurred during export.');
                                                        } finally {
                                                            btn.innerHTML = originalHtml;
                                                            btn.disabled = false;
                                                        }
                                                    }, 100);

                                                } catch (error) {
                                                    console.error('Export error:', error);
                                                    alert('Error occurred while exporting to Excel.');
                                                }
                                            }
                                        </script>
                                    </div>
                                    <div class="table-responsive border-0">
                                        <div data-simplebar style="max-height: 400px;">
                                            <table id="datatable"
                                                class="table table-sm align-middle table-nowrap table-check">
                                                <thead>
                                                    <tr style="background-color:#eee">
                                                        <th>No</th>
                                                        <th>Drm Id</th>
                                                        <th>Member Id</th>
                                                        <th>Order Id</th>
                                                        <th>Company</th>
                                                        <th>Sale Person</th>
                                                        <th>Package</th>
                                                        <th>Type</th>
                                                        <th>Dollar</th>
                                                        <th>Customer Dollar</th>
                                                        <th>Dollar Rate</th>
                                                        <th>Pkr</th>
                                                        <th>Screenshort</th>
                                                        <th>Discount</th>
                                                        <th>Extra Discount</th>
                                                        <th>Extra Pkr Discount</th>
                                                        <th>Status</th>
                                                        <th>Acc Pay Status</th>
                                                        <th>Create Date</th>
                                                        <th>Accountant</th>
                                                        <th>HOD</th>
                                                        <th>Alibaba</th>
                                                        <th>Pay Date</th>


                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <?php
                                                    $i = 0;
                                                    $statusClass = '';
                                                    $alibabaClass = '';
                                                    // $query = "SELECT * FROM webxl_verify_gm WHERE alibaba='Pending' AND webxl_behalf='Installment' AND acc_disc_status != 'Refund' ORDER BY `id` DESC";
                                                    $query = "SELECT g.* FROM webxl_verify_gm g
                                                        JOIN webxl_verify_gm_delay_amount d ON g.id = d.gmid
                                                        WHERE g.alibaba = 'Pending'
                                                        AND g.webxl_behalf = 'Installment'
                                                        AND g.acc_disc_status != 'Refund'
                                                        $dateFilter
                                                        GROUP BY g.id
                                                        HAVING SUM(d.delay_dollar_status = 'Installment' AND d.acc_status = 'Paid' AND d.alibaba = 'Pending') > 0
                                                        ORDER BY g.id DESC";
                                                    $retval = mysqli_query($con, $query);
                                                    $cot = mysqli_num_rows($retval);
                                                    if ($cot > 0) {
                                                        $row = mysqli_fetch_assoc($retval);

                                                        do {

                                                            $d = date("Y-d-m", strtotime($row['create_date']));
                                                            $to = date('Y-d-m');
                                                            $da = date("d", strtotime($row['create_date']));
                                                            $ti = date("h:i", strtotime($row['create_date']));

                                                            $m = date("m/y", strtotime($row['create_date']));
                                                            $conam = comname($row['com_id']);
                                                            $usernam = username($row['user_id']);
                                                            // if($d == $to ){
                                                            if ($row['status'] == 'Cash Received') {
                                                                $statusClass = 'success';
                                                            } elseif ($row['status'] == 'Online Paid') {
                                                                $statusClass = 'warning';
                                                            } else {
                                                                $statusClass = 'secondary';
                                                            }
                                                            if ($row['alibaba'] == 'Yes') {
                                                                $alibabaClass = 'success';
                                                            } elseif ($row['alibaba'] == 'No') {
                                                                $alibabaClass = 'secondary';
                                                            } else {
                                                                $alibabaClass = 'warning';
                                                                $alibabaStatus = 'Waiting';
                                                            }
                                                            if ($row['renwal'] == 1) {
                                                                $renwal = 'New';
                                                            } elseif ($row['renwal'] == 0) {
                                                                $renwal = 'Rc';
                                                            } elseif ($row['renwal'] == 2) {
                                                                $renwal = 'Ec';
                                                            } else {
                                                                $renwal = 'None';
                                                            }
                                                            $comData = comData($row['com_id']);

                                                            $query0 = "SELECT * FROM webxl_verify_gm_delay_amount WHERE com_id='" . $row['com_id'] . "' AND gmid='" . $row['id'] . "' AND delay_dollar_status='Installment' ORDER BY `id` DESC";
                                                            $retval0 = mysqli_query($con, $query0);
                                                            $cot0 = mysqli_num_rows($retval0);

                                                            $query01 = "SELECT * FROM webxl_verify_gm_delay_amount WHERE com_id='" . $row['com_id'] . "' AND gmid='" . $row['id'] . "' AND delay_dollar_status='Installment' AND acc_status='Paid' ORDER BY `id` DESC";
                                                            $retval01 = mysqli_query($con, $query01);
                                                            $cot01 = mysqli_num_rows($retval01);
                                                            if ($cot01 == $cot0) {
                                                                $colorbg = 'table-info text-dark';
                                                                $i++;
                                                    ?>
                                                                <tr class="<?= $colorbg ?>">
                                                                    <td><?= $i ?><input type="hidden" id="comname<?= $i ?>"
                                                                            value="<?= comname($row['com_id']) ?>"></td>
                                                                    <td>(<?= $cot01 ?>/<?= $cot0 ?>) <a
                                                                            href="javascript:void(0)"
                                                                            onclick="ViewInstallMents('<?= $row['id'] ?>')"
                                                                            data-bs-toggle="modal"
                                                                            data-bs-target=".bs-example-modal-xl"><?= $comData['com_id'] ?></a>
                                                                    </td>
                                                                    <td><?= $row['member_id'] ?></td>
                                                                    <td><?= $row['order_id'] ?></td>
                                                                    <td><?= comname($row['com_id']) ?></td>
                                                                    <td><?= username($row['user_id']) ?></td>
                                                                    <td><?= $row['package'] ?></td>
                                                                    <td><?= $renwal ?></td>
                                                                    <td>$ <?= $row['price'] ?></td>
                                                                    <td>$ <?= $row['customer_dollars'] ?></td>
                                                                    <td><?= $row['dollar_rate'] ?></td>
                                                                    <td><?= $row['amount'] ?></td>
                                                                    <td><?php if ($row['screen_shot'] != Null) { ?><a
                                                                                href="./assets/images/gm_payment_screen_short/<?= $row['screen_shot'] ?>"
                                                                                target="_blank" class="text-secondary"><i
                                                                                    class="bx bx-show font-size-20"></i></a><?php } ?>
                                                                    </td>
                                                                    <td>$ <?= $row['discount'] ?></td>
                                                                    <td>$ <?= $row['extra_discount'] ?></td>
                                                                    <td>Pkr <?= $row['extra_pkr_discount'] ?></td>
                                                                    <td>
                                                                        <div class="text-left">
                                                                            <span
                                                                                class="badge rounded-pill badge-soft-<?= $statusClass ?> font-size-11"><?= $row['status'] ?></span>
                                                                        </div>
                                                                    </td>
                                                                    <td><?= $row['acc_pay_status'] ?></td>
                                                                    <td><?= date("d-m-Y", strtotime($row['create_request'])) ?>
                                                                    </td>
                                                                    <td><?= $row['acc_disc_status'] ?></td>
                                                                    <td><?= $row['ceo_disc_status'] ?></td>
                                                                    <td>
                                                                        <div class="text-left">
                                                                            <span
                                                                                class="badge rounded-pill badge-soft-<?= $alibabaClass ?> font-size-11"><?= $row['alibaba'] ?></span>
                                                                        </div>
                                                                    </td>
                                                                    <td><?php if ($row['pay_date'] != NULL) { ?><?= date('d-m-Y', strtotime($row['pay_date'])) ?><?php } else { ?>
                                                                        <div class="text-left">
                                                                            <span
                                                                                class="badge rounded-pill badge-soft-secondary font-size-11">Waiting</span>
                                                                        </div>
                                                                    <?php } ?>
                                                                    </td>


                                                                </tr>
                                                    <?php
                                                                // }
                                                            }
                                                        } while ($row = mysqli_fetch_assoc($retval));
                                                    } ?>
                                                    <script>
                                                        $(document).ready(function() {
                                                            $("#TotalPartialNum_tab").text(<?= $i ?>);
                                                            $("#TotalPartNumTab").text(<?= $i ?>);
                                                            $("#TotalABLiabilitiesPartial").text("(<?= $i ?>)");

                                                        });
                                                    </script>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                            </div>

                        </div>
                        <!--- full and partial tab Payment ---->
                        <!--- Tab Start  ---->
                        <div class="tab-pane " id="temp_payment_tab" role="tabpanel">
                            <div class="card">
                                <div class="card-body">
                                    <a href="javascript:void(0);" class="btn btn-danger btn-sm w-md mb-2"
                                        onclick="GenrateEmailTem()">Generate Email</a>
                                    <div class="table-responsive border-0">
                                        <div data-simplebar style="max-height: 400px;">
                                            <table id="datatableBothMaleFemale"
                                                class="table table-sm align-middle table-nowrap table-check">
                                                <thead>
                                                    <tr style="background-color:#f99d39">
                                                        <th>No</th>
                                                        <th>Date</th>
                                                        <th>Channel Partner</th>
                                                        <th>Mmem Id</th>
                                                        <th>Company Name</th>
                                                        <th>Product Purchased</th>
                                                        <th>Order Type</th>
                                                        <th>Contract No</th>
                                                        <th>Contact Amount</th>
                                                        <th>PayPal Account</th>
                                                        <th>PayPal Amount</th>
                                                        <th>Attach</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <?php
                                                    $i = 0;
                                                    $statusClass = '';
                                                    $alibabaClass = '';

                                                    $query = "SELECT * FROM webxl_dollar_pay_temp WHERE pay_status= 'processing' ORDER BY `id` DESC";
                                                    $retval = mysqli_query($con, $query);
                                                    $cot = mysqli_num_rows($retval);
                                                    if ($cot > 0) {
                                                        $row0 = mysqli_fetch_assoc($retval);

                                                        do {
                                                            $tempComId = $row0['com_id'];
                                                            $tempGmidId = $row0['gmid'];
                                                            $query0 = "SELECT * FROM webxl_verify_gm WHERE id = '$tempGmidId' AND com_id = '$tempComId'  ORDER BY id DESC";
                                                            $retval0 = mysqli_query($con, $query0);
                                                            $cot0 = mysqli_num_rows($retval0);
                                                            $row = mysqli_fetch_assoc($retval0);

                                                            $d = date("Y-d-m", strtotime($row['create_date']));
                                                            $to = date('Y-d-m');
                                                            $da = date("d", strtotime($row['create_date']));
                                                            $ti = date("h:i", strtotime($row['create_date']));

                                                            $m = date("m/y", strtotime($row['create_date']));
                                                            $conam = comname($row['com_id']);
                                                            $usernam = username($row['user_id']);
                                                            // if($d == $to ){
                                                            if ($row['status'] == 'Cash Received') {
                                                                $statusClass = 'success';
                                                            } elseif ($row['status'] == 'Online Paid') {
                                                                $statusClass = 'warning';
                                                            } else {
                                                                $statusClass = 'secondary';
                                                            }
                                                            if ($row['alibaba'] == 'Yes') {
                                                                $alibabaClass = 'success';
                                                            } elseif ($row['alibaba'] == 'No') {
                                                                $alibabaClass = 'secondary';
                                                            } else {
                                                                $alibabaClass = 'warning';
                                                                $alibabaStatus = 'Waiting';
                                                            }
                                                            if ($row['renwal'] == 1) {
                                                                $renwal = 'Nc';
                                                            } elseif ($row['renwal'] == 0) {
                                                                $renwal = 'Rc';
                                                            } elseif ($row['renwal'] == 2) {
                                                                $renwal = 'Ec';
                                                            } else {
                                                                $renwal = 'None';
                                                            }
                                                            $comData = comData($row['com_id']);


                                                            $comName = comname($row['com_id']);
                                                            $buyer_detail = $row0['buyer_detail'];
                                                            $dataArray = json_decode($buyer_detail, true);
                                                            $i++;
                                                    ?>
                                                            <tr>
                                                                <td><?= $i ?></td>
                                                                <td><?= date("d-m-Y", strtotime($row0['create_at'])) ?></td>
                                                                <td>Web Excels</td>
                                                                <td><?= $row['member_id'] ?></td>
                                                                <td><?= comname($row['com_id']) ?></td>
                                                                <td><?= $row['package'] ?></td>
                                                                <td><?= $renwal ?></td>
                                                                <td><?= $row['order_id'] ?></td>
                                                                <td><?= $row['price'] ?></td>
                                                                <td>
                                                                    <?php
                                                                    foreach ($dataArray as $item) { ?>
                                                                        <?= $item['buyer_paypal_email'] ?><br>
                                                                    <?php } ?>
                                                                </td>
                                                                <td>
                                                                    <?php
                                                                    foreach ($dataArray as $item) { ?>
                                                                        <?= $item['dollarUse'] ?><br>
                                                                    <?php } ?>
                                                                </td>
                                                                <td><?php foreach ($dataArray as $item) {
                                                                        $query00 = "SELECT * FROM webxl_dollars_received_history WHERE dollar_slot_id = '" . $item['buyer_dollar_short_id'] . "'";
                                                                        $runu00 = mysqli_query($con, $query00);
                                                                        $row00 = mysqli_fetch_assoc($runu00);
                                                                    ?>
                                                                        <a href="./assets/images/dollar_screenshot/<?= $row00['screen_shot'] ?>"
                                                                            target="_blank" class="text-success">
                                                                            <img class="rounded-circle avatar-xs"
                                                                                src="./assets/images/dollar_screenshot/<?= $row00['screen_shot'] ?>"></a><br>
                                                                    <?php } ?>
                                                                </td>
                                                                <td><a href="javascript:void(0)"
                                                                        onclick="payDollarsDetail_temp(`<?= $comName ?>`,'<?= $row['com_id'] ?>','<?= $row['id'] ?>','<?= $row['member_id'] ?>','<?= $row['order_id'] ?>','<?= $row['price'] - $row0['dollars'] ?>','<?= $row['dollar_rate'] ?>','<?= $row0['id'] ?>','none','none')"
                                                                        class="btn btn-info btn-sm btn-rounded"
                                                                        data-bs-toggle="modal"
                                                                        data-bs-target=".orderdetailsModal">Confirm</a></td>
                                                            </tr>
                                                    <?php
                                                            // }

                                                        } while ($row0 = mysqli_fetch_assoc($retval));
                                                    }
                                                    ?>
                                                    <script>
                                                        $(document).ready(function() {
                                                            $("#TotalPartNumTabTemp").text(<?= $i ?>);

                                                        });
                                                    </script>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- ab libaba tab start -->
                        <!-- ab liabilities tab start -->
                        <div class="tab-pane" id="ab_liabilities_tab" role="tabpanel">
                            <div class="card">
                                <div class="card-body">

                                    <?php
                                    // FULL PAYMENT
                                    $full_online_dollar = round(cash_in_hand_gm_customer_dollars('Online Paid'), 2);
                                    $full_online_pkr = round(cash_in_hand_gm_pkr('Online Paid'), 2);

                                    $full_cash_received_dollar = round(cash_in_hand_gm_customer_dollars('Cash Received'), 2);
                                    $full_cash_received_pkr = round(cash_in_hand_gm_pkr('Cash Received'), 2);

                                    $customer_paid_dollar = round(cash_in_hand_gm_customer_dollars('Customer Paid'), 2);
                                    $customer_paid_pkr = round(cash_in_hand_gm_pkr('Customer Paid'), 2);

                                    // PARTIAL PAYMENT
                                    $partial_online_dollar = round(partial_cash_in_hand_gm_dollars('Online Paid'), 2);
                                    $partial_online_pkr = round(partial_cash_in_hand_gm_pkr('Online Paid'), 2);

                                    $partial_cash_received_dollar = round(partial_cash_in_hand_gm_dollars('Cash Received'), 2);
                                    $partial_cash_received_pkr = round(partial_cash_in_hand_gm_pkr('Cash Received'), 2);

                                    $partial_customer_paid_dollar = round(partial_cash_in_hand_gm_dollars('Customer Paid'), 2);
                                    $partial_customer_paid_pkr = round(partial_cash_in_hand_gm_pkr('Customer Paid'), 2);
                                    $extra_discount_dollar = buyer_dollar_pay_pending_extra_disc();
                                    $extra_discount_pkr = buyer_dollar_pay_pending_extra_disc_pkr();
                                    $installment_extra_discount_dollar = round(partial_cash_in_hand_gm_dollars('Extra Discount Paid'), 2);
                                    $installment_extra_discount_pkr = round(partial_cash_in_hand_gm_pkr('Extra Discount Paid'), 2);

                                    // TOTALS
                                    $total_online_dollar = round($full_online_dollar + $partial_online_dollar, 2);
                                    $total_online_pkr = round($full_online_pkr + $partial_online_pkr, 2);

                                    $total_cash_received_dollar = round($full_cash_received_dollar + $partial_cash_received_dollar, 2);
                                    $total_cash_received_pkr = round($full_cash_received_pkr + $partial_cash_received_pkr, 2);

                                    $total_customer_paid_dollar = round($customer_paid_dollar + $partial_customer_paid_dollar, 2);
                                    $total_customer_paid_pkr = round($customer_paid_pkr + $partial_customer_paid_pkr, 2);

                                    $grand_total_dollar = round(
                                        $total_online_dollar
                                            + $total_cash_received_dollar
                                            + $total_customer_paid_dollar
                                            + $extra_discount_dollar
                                            + $installment_extra_discount_dollar,
                                        2
                                    );

                                    $grand_total_pkr = round(
                                        $total_online_pkr
                                            + $total_cash_received_pkr
                                            + $total_customer_paid_pkr
                                            + $extra_discount_pkr
                                            + $installment_extra_discount_pkr,
                                        2
                                    );

                                    // UNCOMPLETED GM PARTIAL AMOUNT
                                    $base_join = "FROM webxl_verify_gm_delay_amount d2 INNER JOIN webxl_verify_gm g ON d2.gmid = g.id";
                                    $base_where = "d2.delay_dollar_status = 'Installment' AND d2.acc_status IN ('Paid', 'Recoverd') AND g.id IN (SELECT d.gmid FROM webxl_verify_gm_delay_amount d WHERE d.delay_dollar_status = 'Installment' AND d.acc_status = 'Pending') AND g.alibaba='Pending' AND g.webxl_behalf='Installment' AND g.ceo_disc_status != 'Rejected' AND g.acc_disc_status != 'Rejected'";

                                    $q_unc_op = mysqli_query($con, "SELECT COUNT(d2.id) AS total_count, SUM(d2.delay_dollars) AS total_dollar, SUM(d2.delay_pkr) AS total_pkr $base_join WHERE $base_where AND d2.cash_status='Online Paid'");
                                    $r_unc_op = mysqli_fetch_assoc($q_unc_op);
                                    $unc_op_dollar = round((float)$r_unc_op['total_dollar'], 2);
                                    $unc_op_pkr = round((float)$r_unc_op['total_pkr'], 2);

                                    $q_unc_cr = mysqli_query($con, "SELECT COUNT(d2.id) AS total_count, SUM(d2.delay_dollars) AS total_dollar, SUM(d2.delay_pkr) AS total_pkr $base_join WHERE $base_where AND d2.cash_status='Cash Received'");
                                    $r_unc_cr = mysqli_fetch_assoc($q_unc_cr);
                                    $unc_cr_dollar = round((float)$r_unc_cr['total_dollar'], 2);
                                    $unc_cr_pkr = round((float)$r_unc_cr['total_pkr'], 2);

                                    $q_unc_ed = mysqli_query($con, "SELECT COUNT(d2.id) AS total_count, SUM(d2.delay_dollars) AS total_dollar, SUM(d2.delay_pkr) AS total_pkr $base_join WHERE $base_where AND (d2.cash_status='Extra Discount Paid' OR d2.cash_status='Extra Discount')");
                                    $r_unc_ed = mysqli_fetch_assoc($q_unc_ed);
                                    $unc_ed_dollar = round((float)$r_unc_ed['total_dollar'], 2);
                                    $unc_ed_pkr = round((float)$r_unc_ed['total_pkr'], 2);

                                    $uncompleted_gm_dollar = $unc_op_dollar + $unc_cr_dollar + $unc_ed_dollar;
                                    $uncompleted_gm_pkr = $unc_op_pkr + $unc_cr_pkr + $unc_ed_pkr;
                                    $uncompleted_gm_count = (int)$r_unc_op['total_count'] + (int)$r_unc_cr['total_count'] + (int)$r_unc_ed['total_count'];

                                    // ACCOUNT MODULE PENDING DOLLAR AMOUNT
                                    $acc_mod_dollar = 0;
                                    $acc_mod_pkr = 0;
                                    $acc_pending_accounts = buyer_dollar_ab_show_acc_not_pay();
                                    $acc_mod_count = !empty($acc_pending_accounts) ? count($acc_pending_accounts) : 0;
                                    if (!empty($acc_pending_accounts)) {
                                        foreach ($acc_pending_accounts as $list) {
                                            if (is_array($list)) {
                                                $acc_mod_dollar += round((float)$list['dollars'], 2);
                                                $acc_mod_pkr += round((float)$list['remaining_amount'], 2);
                                            } else {
                                                $acc_mod_dollar += round((float)$list->dollars, 2);
                                                $acc_mod_pkr += round((float)$list->remaining_amount, 2);
                                            }
                                        }
                                    }

                                    $grand_total_dollar += $uncompleted_gm_dollar + $acc_mod_dollar;
                                    $grand_total_pkr += $uncompleted_gm_pkr + $acc_mod_pkr;
                                    ?>

                                    <div class="d-flex align-items-center mb-4">
                                        <h4 class="card-title mb-0">
                                            AB Liabilities
                                        </h4>
                                    </div>

                                    <div class="table-responsive">
                                        <table class="table table-bordered table-striped mb-0">
                                            <thead class="thead-light">
                                                <tr>
                                                    <th>Payment Type</th>
                                                    <th>Mode</th>
                                                    <th>USD</th>
                                                    <th>PKR</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td rowspan="3" class="align-middle font-weight-bold">Full Payment <span class="text-danger" id="TotalABLiabilitiesFull"></span></td>
                                                    <td>Online Paid</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($full_online_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($full_online_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td>Cash Received</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($full_cash_received_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($full_cash_received_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td>Extra Discount</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($extra_discount_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($extra_discount_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td rowspan="3" class="align-middle font-weight-bold">Partial Payment <span class="text-danger" id="TotalABLiabilitiesPartial"></span></td>
                                                    <td>Online Paid</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($partial_online_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($partial_online_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td>Cash Received</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($partial_cash_received_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($partial_cash_received_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td>Installment Extra Discount</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($installment_extra_discount_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($installment_extra_discount_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td rowspan="3" class="align-middle font-weight-bold">Uncompleted GM Partials <span class="text-danger">(<?= $uncompleted_gm_count ?>)</span></td>
                                                    <td>Online Paid</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($unc_op_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($unc_op_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td>Cash Received</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($unc_cr_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($unc_cr_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td>Extra Discount</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($unc_ed_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($unc_ed_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td>Dollar Vendor Outstanding Payment</td>
                                                    <td class="text-center">-</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-success font-size-12">
                                                            $ <?= number_format($acc_mod_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-danger font-size-12">
                                                            Pkr <?= number_format($acc_mod_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>

                                                <tr class="table-active">
                                                    <td class="align-middle font-weight-bold">Total</td>
                                                    <td>All Payments</td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-primary font-size-12">
                                                            $ <?= number_format($grand_total_dollar, 2) ?>
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-pill badge-soft-warning font-size-12">
                                                            Pkr <?= number_format($grand_total_pkr, 2) ?>
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                </div>
                            </div>
                        </div>

                        <script>
                            $(document).ready(function() {
                                // Removed TotalABLiabilities initialization
                            });
                        </script>
                    </div>
                    <!--- Tab Start end  ---->
                    <!--- Loan Payment ---->
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title mb-3">Loan Payment Received
                                &nbsp;&nbsp;&nbsp; NC(<span class="text-success font-size-11 " id="NC_loan"></span>)
                                &nbsp;&nbsp;&nbsp; RC(<span class="text-info font-size-11" id="RC_loan"></span>)
                                &nbsp;&nbsp;&nbsp; EC(<span class="text-danger font-size-11" id="EC_loan"></span>)
                            </h4>
                            <div class="row">
                                <div class="col-12">
                                    <div>
                                        <div>
                                            <div class="row mb-2">
                                                <div class="col-sm-4">
                                                    <div class="search-box me-2 mb-2 d-inline-block">
                                                        <div class="position-relative">
                                                            <input type="text" id="searchInput_loan"
                                                                class="form-control" placeholder="Search...">
                                                            <i class="bx bx-search-alt search-icon"></i>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="col-sm-8">
                                                    <!--  <div class="text-sm-end">
                                                    <button type="button" class="btn btn-success btn-rounded waves-effect waves-light mb-2 me-2"><i class="mdi mdi-plus me-1"></i> New Customers</button>
                                                </div> -->
                                                </div><!-- end col-->
                                            </div>

                                            <div class="table-responsive border-0">
                                                <table class="table table-sm align-middle table-nowrap">
                                                    <thead>
                                                        <tr>
                                                            <th>#</th>
                                                            <th>Drm id</th>
                                                            <th>Joining Date</th>
                                                            <th>Company</th>
                                                            <th>Sale Person</th>
                                                            <th>Dollar</th>
                                                            <th>Pkr</th>
                                                            <th>Dollar Rate</th>
                                                            <th>Ex-Disc</th>
                                                            <th>Ex-Disc Pkr</th>
                                                            <th>loan Amount</th>
                                                            <th>Package</th>
                                                            <th>Type</th>
                                                            <th>Expire</th>
                                                            <th>Droupout</th>
                                                            <th>Status</th>
                                                            <th>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody id="showdata_loan">

                                                    </tbody>
                                                </table>
                                            </div>
                                            <ul class="pagination pagination-rounded justify-content-end mb-2">
                                                <li class="page-item ">
                                                    <a class="page-link" href="javascript: void(0);"
                                                        aria-label="Previous" id="prevPage_loan">
                                                        <i class="mdi mdi-chevron-left"></i>
                                                    </a>
                                                </li>
                                                <span class="d-flex" id="pageNumbers_loan"></span>
                                                <li class="page-item">
                                                    <a class="page-link" href="javascript: void(0);"
                                                        aria-label="Next" id="nextPage_loan">
                                                        <i class="mdi mdi-chevron-right"></i>
                                                    </a>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- end row -->
                        </div>
                    </div>
                    <!--- Loan Payment ---->
                    <!-------- partial payment --------->
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title mb-3">Partial Payment Received  <span
                                    class="text-danger font-size-14" id="TotalPartialNum"></span>     Cash Received
                                <span class="badge badge-pill badge-soft-success font-size-11">$
                                    <?= round(partial_cash_in_hand_gm_dollars('Cash Received') + partial_cash_in_hand_gm_dollars('Extra Discount Paid'), 2) ?>
                                </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                    <?= round(partial_cash_in_hand_gm_pkr('Cash Received') + partial_cash_in_hand_gm_pkr('Extra Discount Paid'), 2) ?>
                                </span>      Online Paid <span
                                    class="badge badge-pill badge-soft-success font-size-11">$
                                    <?= partial_cash_in_hand_gm_dollars('Online Paid') ?>
                                </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                    <?= partial_cash_in_hand_gm_pkr('Online Paid') ?>
                                </span>     Customer Paid <span
                                    class="badge badge-pill badge-soft-success font-size-11">$
                                    <?= partial_cash_in_hand_gm_dollars('Customer Paid') ?>
                                </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                    <?= partial_cash_in_hand_gm_pkr('Customer Paid') ?>
                                </span>
                            </h4>
                            <div class="row">
                                <div class="col-12">
                                    <div>
                                        <div>
                                            <div class="row mb-2">
                                                <div class="col-sm-3">
                                                    <div class="search-box me-2 mb-2 d-inline-block w-100">
                                                        <div class="position-relative">
                                                            <input type="text" id="searchInput5"
                                                                class="form-control" placeholder="Search...">
                                                            <i class="bx bx-search-alt search-icon"></i>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="col-sm-2">
                                                    <input type="date" id="fromDate5" class="form-control mb-2">
                                                </div>

                                                <div class="col-sm-2">
                                                    <input type="date" id="toDate5" class="form-control mb-2">
                                                </div>

                                                <div class="col-sm-2">
                                                    <button type="button" id="clearFilter5"
                                                        class="btn btn-secondary btn-sm mb-2 w-100">
                                                        Clear
                                                    </button>
                                                </div>

                                                <div class="col-sm-3 d-flex">
                                                    <button type="button" class="btn btn-success btn-sm mb-2 w-50 me-1" id="exportCsvBtn5">
                                                        Export CSV
                                                    </button>
                                                    <button type="button" class="btn btn-info btn-sm mb-2 w-50" id="exportXlsBtn5">
                                                        Export XLS
                                                    </button>
                                                </div>
                                                <script>
                                                    function exportPartialPayment(format) {
                                                        const btnId = format === 'csv' ? 'exportCsvBtn5' : 'exportXlsBtn5';
                                                        const btn = document.getElementById(btnId);
                                                        const originalText = btn.innerText;
                                                        btn.innerText = "Exporting...";
                                                        btn.disabled = true;

                                                        const search = document.getElementById('searchInput5') ? document.getElementById('searchInput5').value : '';
                                                        const fromDate = document.getElementById('fromDate5') ? document.getElementById('fromDate5').value : '';
                                                        const toDate = document.getElementById('toDate5') ? document.getElementById('toDate5').value : '';

                                                        $.ajax({
                                                            url: 'layouts/func.php',
                                                            type: 'POST',
                                                            data: {
                                                                export_dollar_gm5_partial: true,
                                                                search: search,
                                                                fromDate5: fromDate,
                                                                toDate5: toDate
                                                            },
                                                            dataType: 'json',
                                                            success: function(data) {
                                                                btn.innerText = originalText;
                                                                btn.disabled = false;

                                                                if (data.records && data.records.length > 0) {
                                                                    const exportData = [];
                                                                    const headers = ['S.No', 'Drm Id', 'Company', 'Package', 'Pay Date', 'Dollar', 'Pkr', 'Dollar Rate', 'Type', 'Status'];
                                                                    exportData.push(headers);

                                                                    let n = 1;
                                                                    data.records.forEach(row => {
                                                                        let price = row.acc_pay_status == 'Customer Paid' ? row.extra_discount : row.price;
                                                                        let amount = row.acc_pay_status == 'Customer Paid' ? row.extra_pkr_discount : row.amount;

                                                                        exportData.push([
                                                                            n++,
                                                                            row.com_id || '',
                                                                            row.cname || '',
                                                                            row.package || '',
                                                                            row.pay_date ? new Date(row.pay_date).toISOString().slice(0, 10) : '',
                                                                            price || '',
                                                                            amount || '',
                                                                            row.dollar_rate || '',
                                                                            row.acc_pay_status || '',
                                                                            row.status || ''
                                                                        ]);
                                                                    });

                                                                    const wb = XLSX.utils.book_new();
                                                                    const ws = XLSX.utils.aoa_to_sheet(exportData);
                                                                    XLSX.utils.book_append_sheet(wb, ws, "Partial Payment");

                                                                    const filename = "partial_payment_" + new Date().toISOString().slice(0, 10);
                                                                    if (format === 'csv') {
                                                                        XLSX.writeFile(wb, filename + ".csv");
                                                                    } else {
                                                                        XLSX.writeFile(wb, filename + ".xlsx");
                                                                    }
                                                                } else {
                                                                    alert("No data available to export!");
                                                                }
                                                            },
                                                            error: function(e) {
                                                                btn.innerText = originalText;
                                                                btn.disabled = false;
                                                                console.error(e);
                                                                alert("Error exporting data.");
                                                            }
                                                        });
                                                    }

                                                    document.addEventListener("DOMContentLoaded", function() {
                                                        setTimeout(function() {
                                                            $('#exportCsvBtn5').on('click', function() {
                                                                exportPartialPayment('csv');
                                                            });
                                                            $('#exportXlsBtn5').on('click', function() {
                                                                exportPartialPayment('xls');
                                                            });
                                                        }, 1000);
                                                    });
                                                </script>
                                            </div>
                                            <!--  Extra Large modal example -->
                                            <div class="modal fade bs-example-modal-xl" tabindex="-1" role="dialog"
                                                aria-labelledby="myExtraLargeModalLabel" aria-hidden="true">
                                                <div class="modal-dialog modal-xl"
                                                    style="max-width: 1420px !important;">
                                                    <div class="modal-content">
                                                        <div class="modal-header">
                                                            <h5 class="modal-title" id="myExtraLargeModalLabel">
                                                                Partial Payment Installment</h5>
                                                            <button type="button" class="btn-close"
                                                                data-bs-dismiss="modal" aria-label="Close"></button>
                                                        </div>
                                                        <div class="modal-body">
                                                            <div class="table-responsive border-0">
                                                                <table
                                                                    class="table table-sm align-middle table-nowrap">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>#</th>
                                                                            <th>Drm id</th>
                                                                            <th>Partial Date</th>
                                                                            <th>Company</th>
                                                                            <th>Sale Person</th>
                                                                            <th>Dollar</th>
                                                                            <th>Pkr</th>
                                                                            <th>Dollar Rate</th>
                                                                            <th>Partial Dollar</th>
                                                                            <th>Partial Dollar Rate</th>
                                                                            <th>Partial Pkr</th>
                                                                            <th>Partial Status</th>
                                                                            <th>Package</th>
                                                                            <th>Type</th>
                                                                            <th>Droupout</th>
                                                                            <th>Status</th>
                                                                            <th>Action</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody id="showdata5">

                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div><!-- /.modal-content -->
                                                </div><!-- /.modal-dialog -->
                                            </div><!-- /.modal -->
                                            <div class="table-responsive border-0">
                                                <div data-simplebar style="max-height: 400px;">
                                                    <table id="datatable"
                                                        class="table table-sm align-middle table-nowrap table-check">
                                                        <thead>
                                                            <tr style="background-color:#eee">
                                                                <th>No</th>
                                                                <th>Drm Id</th>
                                                                <th>Member Id</th>
                                                                <th>Order Id</th>
                                                                <th>Company</th>
                                                                <th>Sale Person</th>
                                                                <th>Package</th>
                                                                <th>Type</th>
                                                                <th>Dollar</th>
                                                                <th>Customer Dollar</th>
                                                                <th>Dollar Rate</th>
                                                                <th>Pkr</th>
                                                                <th>Screenshort</th>
                                                                <th>Discount</th>
                                                                <th>Extra Discount</th>
                                                                <th>Extra Pkr Discount</th>
                                                                <th>Status</th>
                                                                <th>Create</th>
                                                                <th>Accountant</th>
                                                                <th>HOD</th>
                                                                <th>Alibaba</th>
                                                                <th>Pay Date</th>


                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <?php
                                                            $i = 0;
                                                            $statusClass = '';
                                                            $alibabaClass = '';
                                                            $query = "SELECT * FROM webxl_verify_gm WHERE alibaba='Pending' AND webxl_behalf='Installment' AND ceo_disc_status != 'Rejected' AND acc_disc_status != 'Rejected' ORDER BY `id` DESC";
                                                            $retval = mysqli_query($con, $query);
                                                            $cot = mysqli_num_rows($retval);
                                                            if ($cot > 0) {
                                                                $row = mysqli_fetch_assoc($retval);

                                                                do {

                                                                    $d = date("Y-d-m", strtotime($row['create_date']));
                                                                    $to = date('Y-d-m');
                                                                    $da = date("d", strtotime($row['create_date']));
                                                                    $ti = date("h:i", strtotime($row['create_date']));

                                                                    $m = date("m/y", strtotime($row['create_date']));
                                                                    $conam = comname($row['com_id']);
                                                                    $usernam = username($row['user_id']);
                                                                    // if($d == $to ){
                                                                    if ($row['status'] == 'Cash Received') {
                                                                        $statusClass = 'success';
                                                                    } elseif ($row['status'] == 'Online Paid') {
                                                                        $statusClass = 'warning';
                                                                    } else {
                                                                        $statusClass = 'secondary';
                                                                    }
                                                                    if ($row['alibaba'] == 'Yes') {
                                                                        $alibabaClass = 'success';
                                                                    } elseif ($row['alibaba'] == 'No') {
                                                                        $alibabaClass = 'secondary';
                                                                    } else {
                                                                        $alibabaClass = 'warning';
                                                                        $alibabaStatus = 'Waiting';
                                                                    }
                                                                    if ($row['renwal'] == 1) {
                                                                        $renwal = 'New';
                                                                    } elseif ($row['renwal'] == 0) {
                                                                        $renwal = 'Rc';
                                                                    } elseif ($row['renwal'] == 2) {
                                                                        $renwal = 'Ec';
                                                                    } else {
                                                                        $renwal = 'None';
                                                                    }
                                                                    $comData = comData($row['com_id']);
                                                                    // $query0 = "SELECT * FROM webxl_verify_gm_delay_amount WHERE com_id='".$row['com_id']."' AND gmid='".$row['id']."' AND acc_status='Pending' ORDER BY `id` DESC";
                                                                    // $retval0 = mysqli_query($con , $query0);
                                                                    // $cot0 = mysqli_num_rows($retval0); 
                                                                    // $row0= mysqli_fetch_assoc($retval0);
                                                                    // if($cot0 > 0){
                                                                    $query0 = "SELECT * FROM webxl_verify_gm_delay_amount WHERE com_id='" . $row['com_id'] . "' AND gmid='" . $row['id'] . "' AND delay_dollar_status='Installment' ORDER BY `id` DESC";
                                                                    $retval0 = mysqli_query($con, $query0);
                                                                    $cot0 = mysqli_num_rows($retval0);

                                                                    $query01 = "SELECT * FROM webxl_verify_gm_delay_amount WHERE com_id='" . $row['com_id'] . "' AND gmid='" . $row['id'] . "' AND delay_dollar_status='Installment' AND acc_status='Paid' ORDER BY `id` DESC";
                                                                    $retval01 = mysqli_query($con, $query01);
                                                                    $cot01 = mysqli_num_rows($retval01);
                                                                    if ($cot01 != $cot0) {
                                                                        $colorbg = '';
                                                                        $i++;
                                                            ?>
                                                                        <tr class="<?= $colorbg ?>">
                                                                            <td><?= $i ?><input type="hidden"
                                                                                    id="comname<?= $i ?>"
                                                                                    value="<?= comname($row['com_id']) ?>"></td>
                                                                            <td>(<?= $cot01 ?>/<?= $cot0 ?>) <a
                                                                                    href="javascript:void(0)"
                                                                                    onclick="ViewInstallMents('<?= $row['id'] ?>')"
                                                                                    data-bs-toggle="modal"
                                                                                    data-bs-target=".bs-example-modal-xl"><?= $comData['com_id'] ?></a>
                                                                            </td>
                                                                            <td><?= $row['member_id'] ?></td>
                                                                            <td><?= $row['order_id'] ?></td>
                                                                            <td><?= comname($row['com_id']) ?></td>
                                                                            <td><?= username($row['user_id']) ?></td>
                                                                            <td><?= $row['package'] ?></td>
                                                                            <td><?= $renwal ?></td>
                                                                            <td>$ <?= $row['price'] ?></td>
                                                                            <td>$ <?= $row['customer_dollars'] ?></td>
                                                                            <td><?= $row['dollar_rate'] ?></td>
                                                                            <td><?= $row['amount'] ?></td>
                                                                            <td><?php if ($row['screen_shot'] != Null) { ?><a
                                                                                        href="./assets/images/gm_payment_screen_short/<?= $row['screen_shot'] ?>"
                                                                                        target="_blank" class="text-secondary"><i
                                                                                            class="bx bx-show font-size-20"></i></a><?php } ?>
                                                                            </td>
                                                                            <td>$ <?= $row['discount'] ?></td>
                                                                            <td>$ <?= $row['extra_discount'] ?></td>
                                                                            <td>Pkr <?= $row['extra_pkr_discount'] ?></td>
                                                                            <td>
                                                                                <div class="text-left">
                                                                                    <span
                                                                                        class="badge rounded-pill badge-soft-<?= $statusClass ?> font-size-11"><?= $row['status'] ?></span>
                                                                                </div>
                                                                            </td>
                                                                            <td><?= date("d-m-Y", strtotime($row['create_request'])) ?>
                                                                            </td>
                                                                            <td><?= $row['acc_disc_status'] ?></td>
                                                                            <td><?= $row['ceo_disc_status'] ?></td>
                                                                            <td>
                                                                                <div class="text-left">
                                                                                    <span
                                                                                        class="badge rounded-pill badge-soft-<?= $alibabaClass ?> font-size-11"><?= $row['alibaba'] ?></span>
                                                                                </div>
                                                                            </td>
                                                                            <td><?php if ($row['pay_date'] != NULL) { ?><?= date('d-m-Y', strtotime($row['pay_date'])) ?><?php } else { ?>
                                                                                <div class="text-left">
                                                                                    <span
                                                                                        class="badge rounded-pill badge-soft-secondary font-size-11">Waiting</span>
                                                                                </div>
                                                                            <?php } ?>
                                                                            </td>


                                                                        </tr>
                                                            <?php
                                                                        // }
                                                                    }
                                                                } while ($row = mysqli_fetch_assoc($retval));
                                                            } ?>
                                                            <script>
                                                                $(document).ready(function() {
                                                                    $("#TotalPartialNum").text(<?= $i ?>);
                                                                });
                                                            </script>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            <!--  <ul class="pagination5 pagination-rounded justify-content-end mb-2" style="display: flex; padding-left: 0; list-style: none;">
                                            <li class="page-item ">
                                                <a class="page-link" href="javascript: void(0);" aria-label="Previous5" id="prevPage5">
                                                    <i class="mdi mdi-chevron-left"></i>
                                                </a>
                                            </li>
                                            <span class="d-flex" id="pageNumbers5" ></span>
                                            <li class="page-item">
                                                <a class="page-link" href="javascript: void(0);" aria-label="Next5" id="nextPag5">
                                                    <i class="mdi mdi-chevron-right"></i>
                                                </a>
                                            </li>
                                        </ul> -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- end row -->
                        </div>
                    </div>
                    <!-------- partial payment --------->
                    <!-------- approval pending --------->
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title mb-3 text-danger">Pending Approvalsss  <span
                                    class="text-danger font-size-14" id="TotalPendingNum"></span>   Cash Received
                                <span class="badge badge-pill badge-soft-success font-size-11">$
                                    <?= gm_approval_pending_from_hod_accounts_cash_in_hand_dollars('Cash Received') ?>
                                </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                    <?= gm_approval_pending_from_hod_accounts_cash_in_hand_pkr('Cash Received') ?>
                                </span>      Online Paid <span
                                    class="badge badge-pill badge-soft-success font-size-11">$
                                    <?= gm_approval_pending_from_hod_accounts_cash_in_hand_dollars('Online Paid') ?>
                                </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                    <?= gm_approval_pending_from_hod_accounts_cash_in_hand_pkr('Online Paid') ?>
                                </span>     Customer Paid <span
                                    class="badge badge-pill badge-soft-success font-size-11">$
                                    <?= gm_approval_pending_from_hod_accounts_cash_in_hand_dollars('Customer Paid') ?>
                                </span> <span class="badge badge-pill badge-soft-danger font-size-11">Pkr
                                    <?= gm_approval_pending_from_hod_accounts_cash_in_hand_pkr('Customer Paid') ?>
                                </span>
                            </h4>
                            <div class="row">
                                <div class="col-12">
                                    <div>
                                        <div>
                                            <div class="table-responsive border-0">
                                                <div data-simplebar style="max-height: 400px;">
                                                    <table id="datatable-buttons-new"
                                                        class="table table-sm align-middle table-nowrap">
                                                        <thead>
                                                            <tr>
                                                                <th>#</th>
                                                                <th>Drm id</th>
                                                                <th>Company</th>
                                                                <th>Sale Person</th>
                                                                <th>Dollar</th>
                                                                <th>Pkr</th>
                                                                <th>Dollar Rate</th>
                                                                <th>Ab Disc</th>
                                                                <th>Extra Disc</th>
                                                                <th>Package</th>
                                                                <th>Type</th>
                                                                <th>Droupout</th>
                                                                <th>Status</th>
                                                                <th>Accountant</th>
                                                                <th>HOD</th>

                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <?php
                                                            $n = 0;
                                                            $companies_List = json_decode(gm_approval_pending_from_hod_accounts());
                                                            foreach ($companies_List as $list) {
                                                                $n++;
                                                                $comData = comData($list->com_id);
                                                                if ($list->renwal == 1) {
                                                                    $renwal = 'New';
                                                                } elseif ($list->renwal == 0) {
                                                                    $renwal = 'Rc';
                                                                } elseif ($list->renwal == 2) {
                                                                    $renwal = 'Ec';
                                                                } else {
                                                                    $renwal = 'None';
                                                                }
                                                                if ($list->droupout == 1) {
                                                                    $droupout = 'Basic Drop';
                                                                } elseif ($list->droupout == 2) {
                                                                    $droupout = 'Basic Plus Drop';
                                                                } elseif ($list->droupout == 3) {
                                                                    $droupout = 'Basic P/D';
                                                                } elseif ($list->droupout == 4) {
                                                                    $droupout = 'Basic Plus P/D';
                                                                } elseif ($list->droupout == 5) {
                                                                    $droupout = 'Pkg Update';
                                                                } else {
                                                                    $droupout = 'None';
                                                                }
                                                                if ($list->acc_disc_status != 'Rejected') {
                                                            ?>
                                                                    <tr>
                                                                        <td>
                                                                            <?= $n ?>
                                                                        </td>
                                                                        <th>
                                                                            <?= $comData['com_id'] ?>
                                                                        </th>
                                                                        <td class="sticky-td">
                                                                            <?= comname($list->com_id) ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= username($list->user_id) ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->price ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->amount ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->dollar_rate ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->discount ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->extra_discount ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->package ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $renwal ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $droupout ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->status ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->acc_disc_status ?>
                                                                        </td>
                                                                        <td>
                                                                            <?= $list->ceo_disc_status ?>
                                                                        </td>
                                                                    </tr>
                                                                    <script>
                                                                        $(document).ready(function() {
                                                                            $("#TotalPendingNum").text(<?= $n ?>);
                                                                        });
                                                                    </script>
                                                            <?php }
                                                            } ?>

                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- end row -->
                        </div>
                    </div>
                    <!-------- approval pending --------->
                </div>

            </div>
            <!-- end row -->

            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title mb-3">Paid Alibaba <a href="dollar-pay" target="_blank"><i
                                        class="bx bxl-flickr mx-4"></i>Partial Payments Paid To Alibaba</a></h4>
                            <div class="row mb-3 align-items-end">
                                <div class="col-lg-3 col-md-6">
                                    <div class="search-box w-100">
                                        <div class="position-relative">
                                            <input type="text" id="searchInput2" class="form-control"
                                                placeholder="Search...">
                                            <i class="bx bx-search-alt search-icon"></i>
                                        </div>
                                    </div>
                                </div>

                                <div class="col-lg-2 col-md-3">
                                    <input type="date" id="fromDate2" class="form-control">
                                </div>

                                <div class="col-lg-2 col-md-3">
                                    <input type="date" id="toDate2" class="form-control">
                                </div>

                                <div class="col-lg-1 col-md-3">
                                    <button type="button" id="clearFilter2" class="btn btn-sm btn-secondary w-100">
                                        Clear
                                    </button>
                                </div>


                            </div>

                            <div class="row mb-3">
                                <div class="col-12">

                                    <button type="button"
                                        class="btn btn-primary btn-sm btn-rounded waves-effect waves-light me-2 mb-2"
                                        onclick="exportToExcel()">
                                        <i class="bx bx-download me-1"></i>Export to Excel
                                    </button>

                                    <button type="button"
                                        class="btn btn-danger btn-sm btn-rounded waves-effect waves-light mb-2 me-2"
                                        onclick="viewCuurentQueDetail('All','All','<?= $start ?>','<?= $end ?>','processing','No')">
                                        <i class="bx bx-dollar me-1"></i>In Processing
                                        <span id="inProccessing1">
                                            <?= getDollarPayByStatusStartEndIn_Processing($start, $end, 'processing') ?>
                                        </span>
                                    </button>

                                    <button type="button"
                                        class="btn btn-warning btn-sm btn-rounded waves-effect waves-light mb-2 me-2"
                                        onclick="viewCuurentQueDetail('All','All','<?= $start ?>','<?= $end ?>','All','All')">
                                        <i class="bx bx-dollar me-1"></i>Extra Disc
                                        <span id="inProccessing2">
                                            <?= getDollarPayByStatusStartEndExtra_Discount($start, $end) ?>
                                        </span>
                                    </button>

                                    <button type="button"
                                        class="btn btn-success btn-sm btn-rounded waves-effect waves-light mb-2 me-2"
                                        onclick="viewCuurentQueDetail('All','All','<?= $start ?>','<?= $end ?>','paid','No')">
                                        <i class="bx bx-dollar me-1"></i>Paid
                                        <span id="inProccessing3">
                                            <?= getDollarPayByStatusStartEndIn_Processing($start, $end, 'paid') ?>
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-12">
                                    <button type="button"
                                        class="btn btn-success btn-sm btn-rounded waves-effect waves-light mb-2 me-2">
                                        <i class="bx bx-dollar me-1"></i>Current Profit
                                        <span id="showdata2Fotter3"></span>
                                    </button>

                                    <button type="button"
                                        class="btn btn-danger btn-sm btn-rounded waves-effect waves-light mb-2 me-2">
                                        <i class="bx bx-dollar me-1"></i>Current Loss
                                        <span id="showdata2Fotter4"></span>
                                    </button>

                                    <button type="button"
                                        class="btn btn-success btn-sm btn-rounded waves-effect waves-light mb-2 me-2">
                                        <i class="bx bx-dollar me-1"></i>Custom Profit
                                        <span id="showdata2Fotter5"></span>
                                    </button>

                                    <button type="button"
                                        class="btn btn-danger btn-sm btn-rounded waves-effect waves-light mb-2 me-2">
                                        <i class="bx bx-dollar me-1"></i>Custom Loss
                                        <span id="showdata2Fotter6"></span>
                                    </button>

                                    <button type="button"
                                        class="btn btn-warning btn-sm btn-rounded waves-effect waves-light mb-2 me-2">
                                        <i class="bx bx-dollar me-1"></i>Extra Discount
                                        <span id="showdata2Fotter7"></span>
                                    </button>
                                </div>
                            </div>
                        </div><!-- end col-->
                    </div>

                    <div class="table-responsive border-0" id="payment_received2">
                        <table class="table align-middle table-sm table-nowrap table-check">
                            <thead class="table-light">
                                <tr>
                                    <th style="width: 20px;" class="align-middle">
                                        <div class="form-check font-size-13">
                                            <input class="form-check-input" type="checkbox" id="checkAll">
                                            <label class="form-check-label" for="checkAll"></label>
                                        </div>
                                    </th>
                                    <th class="align-middle">Ab Date</th>
                                    <th class="align-middle">Bv Date</th>
                                    <th class="align-middle">Drm Id</th>
                                    <th class="align-middle">Ab Id</th>
                                    <th class="align-middle">Order Id</th>
                                    <th class="align-middle">Comapny</th>
                                    <th class="align-middle">Person</th>
                                    <th class="align-middle">T-Dollar</th>
                                    <th class="align-middle">TD Rate</th>
                                    <th class="align-middle">Package</th>
                                    <th class="align-middle">Type</th>
                                    <th class="align-middle">Ex-Disc</th>
                                    <th class="align-middle">Pay Status</th>
                                    <th class="align-middle">Report</th>
                                    <th class="align-middle">Cus $ Rate</th>
                                    <th class="align-middle">Cus $ Profit</th>
                                    <th class="align-middle">View</th>
                                    <th class="align-middle">Action</th>
                                </tr>
                            </thead>
                            <tbody id="showdata2">

                            </tbody>
                            <tfoot id="showdata2Fotter">
                                <tr>

                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <ul class="pagination2 pagination-rounded justify-content-end mb-2"
                        style="display: flex; padding-left: 0; list-style: none;">
                        <li class="page-item">
                            <a class="page-link" href="javascript: void(0);" aria-label="Previous2" id="prevPage2">
                                <i class="mdi mdi-chevron-left"></i>
                            </a>
                        </li>
                        <span class="d-flex" id="pageNumbers2">
                            <li class="page-item active"><a class="page-link" href="#">1</a></li>
                            <li class="page-item"><a class="page-link" href="#">2</a></li>
                            <li class="page-item"><a class="page-link" href="#">3</a></li>
                        </span>
                        <li class="page-item">
                            <a class="page-link" href="javascript: void(0);" aria-label="Next2" id="nextPage2">
                                <i class="mdi mdi-chevron-right"></i>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    <!-- end row -->
</div>
</div>
</div>
<!-- Modal -->
<div class="modal fade orderdetailsModal" tabindex="-1" role="dialog" aria-labelledby="orderdetailsModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="orderdetailsModalLabel">Order Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="row">
                    <div class="col-md-6">
                        <p class="mb-2">Member id: <span class="text-primary" id="order_mid"></span></p>
                    </div>
                    <div class="col-md-6">
                        <p class="mb-2 float-end">Order id: <span class="text-primary" id="order_oid"></span></p>
                    </div>
                    <div class="col-md-6">
                        <p class="mb-2">Company Name: <span class="text-primary" id="order_cname"></span></p>
                    </div>
                    <div class="col-md-6">
                        <p class="mb-4 float-end">Order Amount: $<span class="text-primary" id="order_dollar"></span>
                        </p>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table align-middle table-nowrap">
                        <thead>
                            <tr>
                                <th scope="col">#</th>
                                <th scope="col">Buyer</th>
                                <th scope="col">Use</th>
                                <th scope="col">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                        <tbody id="buyerDetails"></tbody>

                        <tr>
                            <td colspan="2">
                                <h6 class="m-0 text-right">Dollar Rate:</h6>
                            </td>
                            <td></td>
                            <td id="order_dollar_rate">

                            </td>

                        </tr>
                        <tr>
                            <td colspan="2">
                                <h6 class="m-0 text-right" id="order_text"></h6>
                            </td>
                            <td></td>
                            <td>
                                $ <span id="order_text_value"></span>
                            </td>

                        </tr>

                        </tbody>
                    </table>
                    <div class="row w-100 text-center">
                        <div class="col-md-6" id="AddMoreShorForTemp"> </div>
                        <div class="col-md-6" id="showConfirmBtn"> </div>
                    </div>

                </div>
            </div>

        </div>
    </div>
</div>
<!-- end modal -->
<!-- Modal -->
<div class="modal fade orderdetailsModal2" tabindex="-1" role="dialog" aria-labelledby="orderdetailsModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header cus_color">
                <h5 class="modal-title" id="orderdetailsModalLabel"><span id="comNameId">Company Name</span>
                    PKR: <span id="comNameIdPkr" class="text-danger"></span>      Dollar Rate: <span
                        id="comNameIdDollarrate" class="text-danger"></span></h5>
                <button type="button" class="btn-close" id="closeBtn" data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form action="" id="form_gm_acc" class="repeater" enctype="multipart/form-data">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="formrow-password-input" class="form-label" id="formNewInput">Member
                                    Id</label>
                                <input type="hidden" class="form-control" value="" name="dollar_pay_ab_com_id"
                                    id="dollar_pay_ab_com_id">
                                <input type="hidden" class="form-control" value="" name="dollar_pay_ab_gm_id"
                                    id="dollar_pay_ab_gm_id">
                                <input type="hidden" class="form-control" value="<?= $user_id ?>" name="user" id="user">
                                <input type="hidden" class="form-control" value="" name="gmuId" id="gmuId">
                                <input type="hidden" class="form-control" value="" name="cus_dollar_rate"
                                    id="cus_dollar_rate">
                                <input type="hidden" class="form-control" value="" name="cus_profit" id="cus_profit">
                                <input type="text" class="form-control" value="" name="member_id" id="member_id"
                                    placeholder="Enter member id">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-1">
                                <label for="formrow-password-input" class="form-label">Order Id</label>
                                <input type="text" class="form-control" value="" name="order_id" id="order_id"
                                    placeholder="Enter order id">
                            </div>
                        </div>

                        <input type="text" id="pricerange" name="pricerange" />
                        <div class="form-check form-checkbox-outline form-check-primary mb-3">
                            <input class="form-check-input" type="checkbox" id="selectAll" checked="">
                            <label class="form-check-label" for="selectAll">
                                Uncheck The Box For Remove The Unselected Slot
                            </label>
                        </div>
                        <div data-repeater-list="priceRanges" style="font-size: 10px;">

                        </div>


                        <div class="col-md-12">
                            <div class="mb-1">
                                <input type="hidden" class="form-control" value="" name="pkrAmountData"
                                    id="pkrAmountData">
                                <label for="formrow-password-input" class="form-label">Remaining Dollars <span
                                        class="badge badge-soft-success font-size-12" id="remainTotalDollars">
                                    </span>
                                    Custom Dollar Rate <span class="badge badge-soft-danger font-size-12"
                                        id="customDollarRate"> </span>
                                    <span class="text-success form-label font-size-12">Profit</span> or <span
                                        class="text-danger form-label font-size-12">Loss</span> <span
                                        class="badge badge-soft-danger font-size-12" id="profitOrloss"> </span>
                                    Dollar Pkr <span class="badge badge-soft-danger font-size-12" id="profitOrlossPker">
                                    </span> Short Sum <span class="badge badge-soft-danger font-size-12" id="short_sum">
                                    </span></label>
                                <div class="mb-3 mt-3 mt-lg-0">
                                    <div class="row">
                                        <div class="col-sm-6">
                                            <div class="input-group mb-2 currency-value">
                                                <span class="input-group-text">Dollar</span>
                                                <input type="text" id="dollar" name="dollar"
                                                    pattern="[0-9]+([\.,][0-9]+)?"
                                                    title="Please enter only numeric values" class="form-control">
                                            </div>
                                        </div>

                                        <div class="col-sm-6">
                                            <div class="input-group mb-2">
                                                <input type="text" id="dollar_rate" name="dollar_rate"
                                                    class="form-control text-sm-end">
                                                <span class="input-group-text">Dollar Rate</span>
                                            </div>
                                        </div>
                                        <span id="errorMessage" class="text-danger"></span>
                                    </div>

                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-1">
                                <label for="formrow-password-input" class="form-label">Pkr Amount</label>
                                <div class="mb-3 mt-3 mt-lg-0">
                                    <input type="text" class="form-control" id="pkr_amount" name="pkr_amount"
                                        placeholder="0.00" readonly>

                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-1">
                                <label for="formrow-password-input" class="form-label">Date</label>
                                <div class="input-group" id="datepicker1">
                                    <input type="text" class="form-control" placeholder="yyyy-m-dd"
                                        data-date-format="yyyy-m-dd" name="startData" required
                                        data-date-container="#datepicker1" data-provide="datepicker" autocomplete="off">
                                    <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-1">
                                <label for="formrow-password-input" class="form-label">Type</label>
                                <div class="mb-3 ajax-select mt-3 mt-lg-0">
                                    <select name="newGm" id="newGm" class="form-select select2" style="width:290px">
                                        <optgroup label="Type">
                                            <option value="" selected disabled>Choose...</option>
                                            <option value="New">New</option>
                                            <option value="Renewal">Renewal</option>
                                            <option value="Expire">Expire</option>
                                        </optgroup>

                                    </select>

                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-1">
                                <label for="formrow-password-input" class="form-label">Detail</label>
                                <div class="mb-3 ajax-select mt-3 mt-lg-0">
                                    <textarea name="note" id="note" rows="1" placeholder="add detail"
                                        class="form-control"></textarea>

                                </div>
                            </div>
                        </div>
                        <div>
                            <button type="submit" name="submit" id="submitBtn"
                                class="btn btn-primary disabled w-100 mt-2 mb-2">Submit</button>
                        </div>
                        <div>
                        </div>
                    </div>

            </div>
            </form>
        </div>
    </div>
</div>
<!-- end modal -->
<!-- Modal -->
<div class="modal fade orderdetailsModal3" tabindex="-1" role="dialog" aria-labelledby=orderdetailsModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id=orderdetailsModalLabel"><span id="comNameId2">Company Name</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form action="" id="pay_ab_update_status">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="formrow-password-input" class="form-label">Member Id</label>
                                <input type="hidden" class="form-control" value="" name="dollar_pay_ab_gm_id2"
                                    id="dollar_pay_ab_gm_id2">
                                <input type="hidden" class="form-control" value="" name="payid2" id="payid2">
                                <input type="hidden" class="form-control" value="<?= $user_id ?>" name="user" id="user">
                                <input type="text" class="form-control" value="" name="member_id2" id="member_id2"
                                    readonly placeholder="Enter member id">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="formrow-password-input" class="form-label">Order Id</label>
                                <input type="text" class="form-control" value="" name="order_id2" id="order_id2"
                                    readonly placeholder="Enter member id">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="formrow-password-input" class="form-label">Ab Payment Status</label>
                                <select name="ab_payment_status" id="ab_payment_status" class="form-select select2"
                                    style="width:290px">
                                    <option value="" selected disabled>Choose...</option>
                                    <option value="paid">Paid</option>
                                    <option value="refund">Refund</option>
                                    <option value="processing">Processing</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-1">
                                <label for="formrow-password-input" class="form-label">Ab Pay Date</label>
                                <div class="input-group" id="datepicker10">
                                    <input type="text" class="form-control" placeholder="yyyy-m-dd"
                                        data-date-format="yyyy-m-dd" name="startData_ab_pay" required
                                        data-date-container="#datepicker10" data-provide="datepicker"
                                        autocomplete="off">
                                    <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-12">
                            <div class="mb-1">
                                <label for="formrow-password-input" class="form-label">Detail</label>
                                <div class="mb-3 ajax-select mt-3 mt-lg-0">
                                    <textarea name="note" id="note" rows="1" placeholder="add detail"
                                        class="form-control"></textarea>

                                </div>
                            </div>
                        </div>
                        <div>
                            <button type="submit" name="submit" class="btn btn-primary w-100 mt-2 mb-2">Submit</button>
                        </div>
                        <div>
                        </div>
                    </div>

            </div>
            </form>
        </div>
    </div>
</div>
<!-- end modal -->
<!-- Modal -->
<div class="modal fade orderdetailsModal3NotShow" tabindex="-1" role="dialog" aria-labelledby=orderdetailsModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id=orderdetailsModalLabel"><span id="mainDollarBuyer">Buyer Name</span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form action="" id="pay_ab_update_status_not_show">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="formrow-password-input" class="form-label">Paypal Email</label>
                                <input type="hidden" class="form-control" value="" name="dollar_buy_id_not_show"
                                    id="dollar_buy_id_not_show">
                                <input type="hidden" class="form-control" value="" name="dollar_slot_id"
                                    id="dollar_slot_id">
                                <input type="hidden" class="form-control" value="<?= $user_id ?>" name="user" id="user">
                                <input type="text" class="form-control" value="" name="not_show_paypal_id"
                                    id="not_show_paypal_id" readonly placeholder="Enter member id">
                            </div>
                        </div>

                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="formrow-password-input" class="form-label">Ab Payment Status</label>
                                <select name="ab_payment_status_show" id="ab_payment_status_show"
                                    class="form-select select2" style="width:290px">
                                    <option value="" selected disabled>Choose...</option>
                                    <option value="Show">Show</option>
                                    <option value="Not Show">Not Show</option>
                                    <option value="Refund">Refund</option>
                                </select>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <div class="mb-1">
                                <label for="formrow-password-input" class="form-label">Date</label>
                                <div class="input-group" id="datepicker101">
                                    <input type="text" class="form-control" placeholder="yyyy-m-dd"
                                        data-date-format="yyyy-m-dd" name="startData_show" required
                                        data-date-container="#datepicker101" data-provide="datepicker"
                                        autocomplete="off">
                                    <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <button type="submit" name="submit" class="btn btn-primary w-100 mt-2 mb-2">Submit</button>
                        </div>
                        <div>
                        </div>
                    </div>

            </div>
            </form>
        </div>
    </div>
</div>
<!-- end modal -->

<div class="modal fade" id="oldDateModal" tabindex="-1" aria-labelledby="oldDateModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title" id="oldDateModalLabel">Company & BV Date Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body">

                <div class="mb-3">
                    <label class="form-label">DRM ID</label>
                    <input type="text" id="modal_com_id" class="form-control" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label">table id</label>
                    <input type="text" id="modal_gmbvid" class="form-control" readonly>
                </div>

                <div class="mb-3">
                    <label class="form-label">Company Name</label>
                    <input type="text" id="modal_cname" class="form-control" readonly>
                </div>

                <div class="mb-3">
                    <label class="form-label">Member ID</label>
                    <input type="text" id="modal_member_id" class="form-control" readonly>
                </div>

                <div class="mb-3">
                    <label class="form-label">GMID</label>
                    <input type="text" id="modal_gmid" class="form-control" readonly>
                </div>

                <div class="mb-3">
                    <label class="form-label">GM BV Date</label>
                    <input type="date" id="modal_bvdate" class="form-control">
                </div>
                <div class="mb-3">
                    <label class="form-label">User BV Date</label>
                    <input type="date" id="modal_userbvdate" class="form-control" readonly>
                </div>

                <div class="mb-3">
                    <label class="form-label">New BV Date</label>
                    <input type="date" id="modal_start_date" class="form-control" readonly>
                </div>

                <div class="mb-3">
                    <label class="form-label">End Date</label>
                    <input type="date" id="modal_end_date" class="form-control" readonly>
                </div>

            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="updateBvBtn">Update</button>
            </div>


        </div>
    </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script>
    $(document).ready(function() {
        function generateTitle() {
            return "Alibaba Paid Payment";
        }

        $("#datatableBothMaleFemale").DataTable({
            dom: "Bfrtip",
            searching: true,
            paging: false,
            ordering: false,
            buttons: [{
                    extend: "copyHtml5",
                    footer: true,
                    filename: function() {
                        return "alibaba_order_list_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                },
                {
                    extend: "excelHtml5",
                    footer: true,
                    filename: function() {
                        return "alibaba_order_list_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    },
                    exportOptions: {
                        format: {
                            body: function(data, row, column, node) {
                                if (column === 12) { // Assuming column 1 has the image HTML
                                    // Create a temporary DOM element to extract the image source
                                    var tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = data; // Set the HTML
                                    var img = tempDiv.querySelector('img'); // Get the <img> element
                                    return img ? img.src : ''; // Return the src or an empty string if no image
                                }
                                return data;
                            }
                        }
                    }
                },
                {
                    extend: "csvHtml5",
                    footer: true,
                    filename: function() {
                        return "alibaba_order_list_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                },
                {
                    extend: "pdfHtml5",
                    footer: true,
                    filename: function() {
                        return "alibaba_order_list_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                }
            ]
        });

        // Adjust button group alignment
        $(".btn-group, .btn-group-vertical").css("float", "left");
    });

    $("#dollar_rate").on("keyup", function() {
        var dollar = $("#dollar").val();
        var dollar_rate = $(this).val();
        var pkr = dollar * dollar_rate;
        $("#pkr_amount").val(pkr);
    });
    $('#updateBvBtn').on('click', function() {

        let data = {
            com_id: $('#modal_com_id').val(),
            table_id: $('#modal_gmbvid').val(),
            gmid: $('#modal_gmid').val(),
            old_bvdate: $('#modal_bvdate').val(),
            start_date: $('#modal_start_date').val(),
            end_date: $('#modal_end_date').val(),
            user_bvdate: $('#modal_userbvdate').val()
        };

        $.ajax({
            url: "layouts/Controller/GmAccountController.php",
            type: "POST",
            data: {
                action: "update_gm_bv_date",
                payload: data
            },
            success: function(res) {
                if (res.trim() === "success") {
                    Swal.fire({
                        title: 'Updated!',
                        text: 'BV Date Updated Successfully!',
                        icon: 'success',
                        confirmButtonText: 'OK'
                    }).then(() => {
                        location.reload();
                    });
                } else {
                    Swal.fire({
                        title: 'Error!',
                        text: res,
                        icon: 'error',
                        confirmButtonText: 'OK'
                    });
                }
            },
            error: function(xhr, status, error) {
                Swal.fire({
                    title: 'AJAX Error!',
                    text: error,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        });

    });



    $(document).ready(function() {
        // Initial load on page load
        loadPage(1);

        // Pagination link click event
        $(document).on('click', '.paginationBtn a', function() {
            var page = $(this).data('page');
            if (page !== undefined && page !== '') {
                loadPage(page);
            }
        });

        // Previous and Next buttons click events
        $('#prevPage').click(function() {
            var currentPage = parseInt($('#pageNumbers li .active').data('page'));
            if (currentPage > 1) {
                loadPage(currentPage - 1);
            }
        });

        $('#nextPage').click(function() {
            var currentPage = parseInt($('#pageNumbers li .active').data('page'));
            var totalPages = parseInt($('#pageNumbers').data('total-pages'));
            if (currentPage < totalPages) {
                loadPage(currentPage + 1);
            }
        });
    });
    $(document).ready(function() {
        loadPage(1);

        $('#searchInput').on('input', function() {
            loadPage(1, $('#searchInput').val(), $('#fromDate').val(), $('#toDate').val());
        });

        $('#fromDate, #toDate').on('change', function() {
            loadPage(1, $('#searchInput').val(), $('#fromDate').val(), $('#toDate').val());
        });

        $('#clearFilter').click(function() {
            $('#searchInput').val('');
            $('#fromDate').val('');
            $('#toDate').val('');
            loadPage(1);
        });

        $(document).on('click', '.pagination a', function() {
            var page = $(this).data('page');
            if (page !== undefined && page !== '') {
                loadPage(page, $('#searchInput').val(), $('#fromDate').val(), $('#toDate').val());
            }
        });

        $('#prevPage').click(function() {
            var currentPage = parseInt($('#pageNumbers .active').data('page'));
            if (currentPage > 1) {
                loadPage(currentPage - 1, $('#searchInput').val(), $('#fromDate').val(), $('#toDate').val());
            }
        });

        $('#nextPage').click(function() {
            var currentPage = parseInt($('#pageNumbers .active').data('page'));
            var totalPages = parseInt($('#pageNumbers').data('total-pages'));
            if (currentPage < totalPages) {
                loadPage(currentPage + 1, $('#searchInput').val(), $('#fromDate').val(), $('#toDate').val());
            }
        });
    });

    function loadPage(page, search = '', fromDate = '', toDate = '') {
        $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            data: {
                page_dollar_gm: page,
                search: search,
                fromDate: fromDate,
                toDate: toDate
            },
            dataType: 'json',
            success: function(data) {
                displayData(data, search, page);
                displayPagination(data.totalPages, page);
                $("#grand_total_price").text(data.grandTotals.total_price);
                $("#grandTotalAmount").text(
                    parseFloat(data.grandTotals.total_amount).toLocaleString()
                );
                $("#grand_total_extra_discount").text(data.grandTotals.total_extra_discount);
                $("#grand_total_extra_pkr_discount").text(data.grandTotals.total_extra_pkr_discount);
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }

    function checkCompanyTempPayment(com_id, gmId) {
        return $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            data: {
                tem_check_com_id: com_id,
                tem_check_com_gmId: gmId
            }
        }).then(function(data) {
            return data.trim();
        });
    }


    function displayData(datas, search, page) {
        // Clear previous data
        var NC = 0;
        var RC = 0;
        var EC = 0;
        $('#showdata').empty();
        var num = ((page - 1) * 10) + 0;
        var itemsContainer = $('#showdata');
        var data = datas.records;
        var renwal = '';
        var droupout = '';

        // Safe string escaping function - define once outside the loop
        function escapeString(str) {
            if (str == null || str == undefined) return '';
            return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        }

        for (var i = 0; i < data.length; i++) {
            let currentDate = new Date(data[i].create_date);
            var day = currentDate.getDate();
            var month = currentDate.getMonth() + 1; // Months are zero-based
            var year = currentDate.getFullYear();
            let type = typeof(data[i].cname);

            if (data[i].renwal == 1) {
                var renwal = 'New';
                NC++;
                var color = 'bg-success';
            } else if (data[i].renwal == 0) {
                var renwal = 'Rc';
                RC++;
                var color = 'bg-info';
            } else if (data[i].renwal == 2) {
                var renwal = 'Ec';
                EC++;
                var color = 'bg-danger';
            } else if (data[i].renwal == 3) {
                var renwal = 'Rc-Up'
                var color = 'bg-warning';
            } else {
                var renwal = 'None';
            }

            if (data[i].droupout == 1) {
                var droupout = 'Basic Drop';
            } else if (data[i].droupout == 2) {
                var droupout = 'Basic Plus Drop';
            } else if (data[i].droupout == 3) {
                var droupout = 'Basic P/D';
            } else if (data[i].droupout == 4) {
                var droupout = 'Basic Plus P/D';
            } else if (data[i].droupout == 5) {
                var droupout = 'Pkg Update';
            } else {
                var droupout = 'None';
            }

            if (data[i].acc_pay_status == 'Customer Paid') {
                var price = data[i].extra_discount;
                var amount = data[i].extra_pkr_discount;
            } else {
                var price = data[i].price;
                var amount = data[i].amount;
            }

            var formattedDate = year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;

            num++;

            // Escape all string values that will be used in onclick functions
            var safeCname = escapeString(data[i].cname);
            var safeVfyGmComId = escapeString(data[i].vfy_gm_com_id);
            var safeGmId = escapeString(data[i].gmId);
            var safeMemberId = escapeString(data[i].member_id);
            var safeOrderId = escapeString(data[i].order_id);
            var safeGmuId = escapeString(data[i].gmuId);
            var safeDollarRate = escapeString(data[i].dollar_rate);
            var safeId = escapeString(data[i].id);
            var safeComId = escapeString(data[i].com_id);

            let pagenation_data = '<tr>';
            pagenation_data += '<td><div class="form-check ">';
            pagenation_data += '' + num + '';
            pagenation_data += '<label class="form-check-label" for="' + data[i].id + '"></label></div></td>';
            pagenation_data += '<td><a href="#createMeating" onclick="funWithDataAttr(this)" data-cname="' + escapeString(data[i].cname) + '" data-id="' + escapeString(data[i].id) + '" class="popup-form text-body fw-bold">' + (data[i].com_id || '') + '</a> </td>';
            pagenation_data += '<td>' + formattedDate + '</td>';

            pagenation_data += '<td href="#createMeating" class="open-popup">' + (data[i].cname || '') + '</td>';
            pagenation_data += '<td>' + (data[i].name || '') + '</td>';
            pagenation_data += '<td>' + (price || '') + '</td>';
            pagenation_data += '<td>' + (data[i].customer_dollars || '') + '</td>';
            pagenation_data += '<td>' + (amount || '') + '</td>';
            pagenation_data += '<td>' + (data[i].dollar_rate || '') + '</td>';
            pagenation_data += '<td>' + (data[i].extra_discount || '') + '</td>';
            pagenation_data += '<td>' + (data[i].extra_pkr_discount || '') + '</td>';
            pagenation_data += '<td>' + (data[i].package || '') + '</td>';
            pagenation_data += '<td><span class="badge badge-pill ' + color + ' font-size-11">' + renwal + '</span></td>';
            pagenation_data += '<td>' + (data[i].expire_date || '') + '</td>';
            pagenation_data += '<td>' + droupout + '</td>';
            pagenation_data += '<td>' + (data[i].status || '') + '</td>';
            pagenation_data += '<td><div class="d-flex gap-1">';
            pagenation_data += '<a href="javascript:void(0)" onclick="paymentPayWithDataAttr(this)" ' +
                'data-cname="' + escapeString(data[i].cname) + '" ' +
                'data-vfy-gm-com-id="' + escapeString(data[i].vfy_gm_com_id) + '" ' +
                'data-gm-id="' + escapeString(data[i].gmId) + '" ' +
                'data-member-id="' + escapeString(data[i].member_id) + '" ' +
                'data-order-id="' + escapeString(data[i].order_id) + '" ' +
                'data-price="' + (price || '') + '" ' +
                'data-amount="' + (amount || '') + '" ' +
                'data-gmu-id="' + escapeString(data[i].gmuId) + '" ' +
                'data-dollar-rate="' + escapeString(data[i].dollar_rate) + '" ' +
                'data-bs-toggle="modal" data-bs-target=".orderdetailsModal2"><button type="button" style="height:1.5rem; width:1.5rem;" class="btn btn-primary position-relative p-0 avatar-xs rounded-circle" title="Pay To Ab">';
            pagenation_data += '<span class="avatar-title bg-transparent text-reset"><i class="bx bxs-dollar-circle"></i></span></button></a>';
            pagenation_data += '<a href="javascript:void(0)" onclick="paymentPayTempWithDataAttr(this)" ' +
                'data-cname="' + escapeString(data[i].cname) + '" ' +
                'data-vfy-gm-com-id="' + escapeString(data[i].vfy_gm_com_id) + '" ' +
                'data-gm-id="' + escapeString(data[i].gmId) + '" ' +
                'data-member-id="' + escapeString(data[i].member_id) + '" ' +
                'data-order-id="' + escapeString(data[i].order_id) + '" ' +
                'data-price="' + (price || '') + '" ' +
                'data-amount="' + (amount || '') + '" ' +
                'data-gmu-id="' + escapeString(data[i].gmuId) + '" ' +
                'data-dollar-rate="' + escapeString(data[i].dollar_rate) + '" ' +
                'data-bs-toggle="modal" data-bs-target=".orderdetailsModal2"><button type="button" style="height:1.5rem; width:1.5rem;" class="btn btn-warning position-relative p-0 avatar-xs rounded-circle" title="Pay Temp Payment">';
            pagenation_data += '<span class="avatar-title bg-transparent text-reset"><i class="bx bx-info-circle"></i></span></button></a>';
            pagenation_data += '</tr>';

            itemsContainer.append(pagenation_data);

            $("#NC").text(NC);
            $("#RC").text(RC);
            $("#EC").text(EC);
        }
        $("#TotalFullNum").text(datas.totalRecords);
        $("#TotalFullNumBtnTab").text(datas.totalRecords);
        $("#TotalABLiabilitiesFull").text("(" + datas.totalRecords + ")");
    }

    function displayPagination(totalPages, currentPage) {
        // Clear previous pagination links
        $('#pageNumbers').empty();

        // Display new pagination links
        var startPage = Math.max(currentPage - 2, 1);
        var endPage = Math.min(currentPage + 1, totalPages);

        if (startPage > 1) {

            $('#pageNumbers').append('<li class="page-item"><a href="javascript:void(0);" class="page-link" data-page="1">1</a></li>');
            if (startPage > 3) {
                $('#pageNumbers').append('<span class="ellipsis">...</span>');
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            var activeClass = (i === currentPage) ? 'active' : '';
            $('#pageNumbers').append('<li class="page-item ' + activeClass + '"><a href="javascript:void(0);" class="page-link ' + activeClass + '" data-page="' + i + '">' + i + '</a></li>');
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                $('#pageNumbers').append('<span class="ellipsis">...</span>');
            }
            $('#pageNumbers').append('<li class="page-item"><a href="javascript:void(0);" class="page-link"  data-page="' + totalPages + '">' + totalPages + '</a></li>');
        }

        $('#pageNumbers').data('total-pages', totalPages);
    }

    // end dollar gm


    // $(document).ready(function () {
    // Function to fetch available price ranges via Ajax
    function fetchAvailablePriceRanges(min, max, orderAmount, check) {

        $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            dataType: 'json',
            data: {
                min: min,
                max: max
            },
            success: function(data) {
                // Clear existing items in the repeater list
                $('[data-repeater-list="priceRanges"]').empty();

                // Loop through the fetched data and append to the repeater list
                // $.each(data, function (index, priceRange) {
                addPriceRangeToRepeater(data, orderAmount, check);
                // });
            },
            error: function(xhr, status, error) {
                console.error('Ajax Error:', status, error);
            }
        });
    }

    // Function to add a price range to the repeater list
    // Function to add a price range to the repeater list
    function addPriceRangeToRepeater(priceRange, order_amount, check) {

        var data = priceRange.records;
        var remainingOrderAmount = order_amount; // Initialize with the total order amount
        var chk = check ? 'checked' : '';
        // Sort data by dollar amounts in ascending order to pick the smallest first
        data.sort((a, b) => parseFloat(a.dollars) - parseFloat(b.dollars));

        // Reference to the repeater list
        var repeaterList = $('[data-repeater-list="priceRanges"]');
        repeaterList.empty(); // Clear the list before adding new items

        for (var i = 0; i < data.length; i++) {
            var dollars = parseFloat(data[i].dollars); // Available dollar amount
            var useDollarAmount = Math.min(dollars, remainingOrderAmount); // Pick the lesser of available or remaining
            // Condition: Select only those with selected = true or those whose remaining amount is zero
            // var isSelected = parseFloat(data[i].selected) || 0;
            // if (isSelected || remainingOrderAmount === 0) {
            // continue;
            // }
            // Reduce the remaining order amount
            remainingOrderAmount -= useDollarAmount;

            // Create a new repeater item
            var newItem = $('<div data-repeater-item class="row"></div>');
            newItem.append(`
            <div class="mb-1 col-md-3 d-flex justify-content-between">
                <div class="form-check mt-4 form-checkbox-outline form-check-danger mx-2 align-middle">
                    <label for="selectcheckBox${i}" class="font-size-12">
                        <input class="form-check-input" type="checkbox" id="selectcheckBox${i}" ${chk} >${i}
                    </label>
                </div>
                <div>
                    <label for="name">Buyer Name</label>
                    <span class="text-danger font-size-10">${data[i].buy_date}</span>
                    <input type="text" value="${data[i].name}" class="form-control"/>
                    <input type="hidden" value="${data[i].buyer_main}" id="buyer_main" name="buyer_main[]"/>
                    <input type="hidden" value="${data[i].name}" id="buyer_main_name" name="buyer_main_name[]"/>
                    <input type="hidden" value="${data[i].dollar_rate}" id="buyer_dollar_rate${data[i].id}" name="buyer_dollar_rate[]"/>
                    <input type="hidden" value="${data[i].id}" id="buyer_dollar_short_id" name="buyer_dollar_short_id[]"/>
                </div>
            </div>
            <div class="mb-1 col-md-3">
                <label for="name">Paypal Email</label>
                <input type="hidden" value="${data[i].buyer_reference}" id="buyer_main_ref" name="buyer_main_ref[]"/>
                <input type="email" value="${data[i].buyer_reference_paypal_email}" id="buyer_paypal_email" name="buyer_paypal_email[]" placeholder="buyer paypal" class="form-control"/>
            </div>
            <div class="mb-1 col-md-1">
                <label for="name">$ Rate 
                    <span class="badge badge-pill badge-soft-danger font-size-12 mt-3">${data[i].dollar_rate}</span>
                </label>
            </div>
            <div class="mb-1 col-md-2">
                <label for="name">Dollars</label>
                <span class="text-danger font-size-14">${data[i].total_short_dollars}</span>
                <input type="number" value="${dollars}" id="dollarTotal" name="dollarTotal[]" placeholder="0.00" class="form-control" readonly/>
            </div>
            <div class="mb-1 col-md-2">
                <label for="name">Use Dollar</label>
                <input type="number" max="${dollars}" onKeyUp="UseMaxValueOnly('${data[i].id}')" value="${useDollarAmount}" id="dollarUse${data[i].id}" step="any" name="dollarUse[]" pattern="[0-9]+([\.,][0-9]+)?" attrPkr="${data[i].pkr_amount}" attrDollars="${dollars}" title="Please enter only numeric values" placeholder="0.00" class="form-control dynamic-input"/>
                <span id="errorMessage${data[i].id}" style="color: red;"></span>
            </div>
            <div class="col-md-1 align-self-center mx-auto pt-4">
                <div class="d-grid">
                    <a href="javascript:void(0);" class="text-danger deletePriceRange">
                        <i class="mdi mdi-delete font-size-18"></i>
                    </a>
                </div>
            </div>
        `);

            // Add the item to the repeater list
            repeaterList.append(newItem);
            if (chk) {
                UseMaxValueOnly(data[i].id);
            }
            // Stop if no more amount needs to be allocated
            if (remainingOrderAmount <= 0) {
                break;
            }

        }

        // Optional: Notify the user if some amount couldn't be allocated
        if (remainingOrderAmount > 0) {
            alert('Not enough dollar amounts to cover the entire order amount.');
        }
    }

    function fetchAvailablePriceRanges_temp(min, max, orderAmount, check) {

        $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            dataType: 'json',
            data: {
                min_temp: min,
                max_temp: max
            },
            success: function(data) {
                // Clear existing items in the repeater list
                $('[data-repeater-list="priceRanges"]').empty();

                // Loop through the fetched data and append to the repeater list
                // $.each(data, function (index, priceRange) {
                if (orderAmount == 'not-show') {
                    addPriceRangeToRepeater_temp_for_slide(data, orderAmount, check);
                } else {
                    addPriceRangeToRepeater_temp(data, orderAmount, check);
                }
                // });
            },
            error: function(xhr, status, error) {
                console.error('Ajax Error:', status, error);
            }
        });
    }



    // genrate tep order code
    function addPriceRangeToRepeater_temp(priceRange, order_amount, check) {

        var data = priceRange.records;
        var remainingOrderAmount = order_amount; // Initialize with the total order amount
        var chk = check ? 'checked' : '';
        // Sort data by dollar amounts in ascending order to pick the smallest first
        // data.sort((a, b) => parseFloat(a.dollars) - parseFloat(b.dollars));

        // Reference to the repeater list
        var repeaterList = $('[data-repeater-list="priceRanges"]');
        repeaterList.empty(); // Clear the list before adding new items
        var exactMatchFound = false;

        // First pass: Check for an exact match in the entire list
        for (var i = 0; i < data.length; i++) {
            var dollars = parseFloat(data[i].dollars); // Available dollar amount
            var useDollarAmount = Math.min(dollars, remainingOrderAmount);

            if (dollars == remainingOrderAmount) {

                alert('Exact match found: ' + dollars);
                remainingOrderAmount -= useDollarAmount; // Subtract the full amount as it's an exact match

                // Create the repeater item
                createRepeaterItem(data[i], dollars, useDollarAmount);
                if (chk) {
                    UseMaxValueOnly(data[i].id);
                }
                exactMatchFound = true;
                break; // Exit the loop as we've found an exact match
            }


        }

        // Second pass: If no exact match was found, start accumulating smaller amounts
        if (!exactMatchFound) {
            for (var i = 0; i < data.length; i++) {
                var dollars = parseFloat(data[i].dollars); // Available dollar amount
                var useDollarAmount = Math.min(dollars, remainingOrderAmount);

                if (dollars < remainingOrderAmount) {
                    remainingOrderAmount -= useDollarAmount; // Subtract the used amount
                    if (chk) {
                        UseMaxValueOnly(data[i].id);
                    }
                    // Create the repeater item
                    createRepeaterItem(data[i], dollars, useDollarAmount);
                }
                if (remainingOrderAmount <= 0) {
                    break;
                }
            }
        }

        function createRepeaterItem(data, dollars, useDollarAmount) {
            var newItem = $('<div data-repeater-item class="row"></div>');
            newItem.append(`
        <div class="mb-1 col-md-3 d-flex justify-content-between">
            <div class="form-check mt-4 form-checkbox-outline form-check-danger mx-2 align-middle">
                <label for="selectcheckBox${i}" class="font-size-12">
                    <input class="form-check-input" type="checkbox" id="selectcheckBox${i}" ${chk} >${i}
                </label>
            </div>
            <div>
                <label for="name">Buyer Name</label>
                <span class="text-danger font-size-10">${data.buy_date}</span>
                <input type="text" value="${data.name}" class="form-control"/>
                <input type="hidden" value="${data.buyer_main}" id="buyer_main" name="buyer_main[]"/>
                <input type="hidden" value="${data.name}" id="buyer_main_name" name="buyer_main_name[]"/>
                <input type="hidden" value="${data.dollar_rate}" id="buyer_dollar_rate${data.id}" name="buyer_dollar_rate[]"/>
                <input type="hidden" value="${data.id}" id="buyer_dollar_short_id" name="buyer_dollar_short_id[]"/>
            </div>
        </div>
        <div class="mb-1 col-md-3">
            <label for="name">Paypal Email</label>
            <input type="hidden" value="${data.buyer_reference}" id="buyer_main_ref" name="buyer_main_ref[]"/>
            <input type="email" value="${data.buyer_reference_paypal_email}" id="buyer_paypal_email" name="buyer_paypal_email[]" placeholder="buyer paypal" class="form-control"/>
        </div>
        <div class="mb-1 col-md-1">
            <label for="name">$ Rate 
                <span class="badge badge-pill badge-soft-danger font-size-12 mt-3">${data.dollar_rate}</span>
            </label>
        </div>
        <div class="mb-1 col-md-2">
            <label for="name">Dollars</label>
            <span class="text-danger font-size-14">${data.total_short_dollars}</span>
            <input type="number" value="${dollars}" id="dollarTotal" name="dollarTotal[]" placeholder="0.00" class="form-control" readonly/>
        </div>
        <div class="mb-1 col-md-2">
            <label for="name">Use Dollar</label>
            <input type="number" max="${dollars}" onKeyUp="UseMaxValueOnly('${data.id}')" value="${useDollarAmount}" id="dollarUse${data.id}" step="any" name="dollarUse[]" pattern="[0-9]+([\.,][0-9]+)?" attrPkr="${data.pkr_amount}" attrDollars="${dollars}" title="Please enter only numeric values" placeholder="0.00" class="form-control dynamic-input"/>
            <span id="errorMessage${data.id}" style="color: red;"></span>
        </div>
        <div class="col-md-1 align-self-center mx-auto pt-4">
            <div class="d-grid">
                <a href="javascript:void(0);" class="text-danger deletePriceRange">
                    <i class="mdi mdi-delete font-size-18"></i>
                </a>
            </div>
        </div>
    `);
            repeaterList.append(newItem);
        }
        // Optional: Notify the user if some amount couldn't be allocated
        if (remainingOrderAmount > 0) {
            alert('Not enough dollar amounts to cover the entire order amount.');
        }
    }
    // Function to add a price range to the repeater list
    function addPriceRangeToRepeater_temp_for_slide(priceRange, order_amount, check) {

        var data = priceRange.records;
        var remainingOrderAmount = order_amount; // Initialize with the total order amount
        var chk = check ? 'checked' : '';
        // Sort data by dollar amounts in ascending order to pick the smallest first
        data.sort((a, b) => parseFloat(a.dollars) - parseFloat(b.dollars));

        // Reference to the repeater list
        var repeaterList = $('[data-repeater-list="priceRanges"]');
        repeaterList.empty(); // Clear the list before adding new items

        for (var i = 0; i < data.length; i++) {
            var dollars = parseFloat(data[i].dollars); // Available dollar amount
            var useDollarAmount = Math.min(dollars, remainingOrderAmount); // Pick the lesser of available or remaining
            // Condition: Select only those with selected = true or those whose remaining amount is zero
            // var isSelected = parseFloat(data[i].selected) || 0;
            // if (isSelected || remainingOrderAmount === 0) {
            // continue;
            // }
            // Reduce the remaining order amount
            remainingOrderAmount -= useDollarAmount;

            // Create a new repeater item
            var newItem = $('<div data-repeater-item class="row"></div>');
            newItem.append(`
            <div class="mb-1 col-md-3 d-flex justify-content-between">
                <div class="form-check mt-4 form-checkbox-outline form-check-danger mx-2 align-middle">
                    <label for="selectcheckBox${i}" class="font-size-12">
                        <input class="form-check-input" type="checkbox" id="selectcheckBox${i}" ${chk} >${i}
                    </label>
                </div>
                <div>
                    <label for="name">Buyer Name</label>
                    <span class="text-danger font-size-10">${data[i].buy_date}</span>
                    <input type="text" value="${data[i].name}" class="form-control"/>
                    <input type="hidden" value="${data[i].buyer_main}" id="buyer_main" name="buyer_main[]"/>
                    <input type="hidden" value="${data[i].name}" id="buyer_main_name" name="buyer_main_name[]"/>
                    <input type="hidden" value="${data[i].dollar_rate}" id="buyer_dollar_rate${data[i].id}" name="buyer_dollar_rate[]"/>
                    <input type="hidden" value="${data[i].id}" id="buyer_dollar_short_id" name="buyer_dollar_short_id[]"/>
                </div>
            </div>
            <div class="mb-1 col-md-3">
                <label for="name">Paypal Email</label>
                <input type="hidden" value="${data[i].buyer_reference}" id="buyer_main_ref" name="buyer_main_ref[]"/>
                <input type="email" value="${data[i].buyer_reference_paypal_email}" id="buyer_paypal_email" name="buyer_paypal_email[]" placeholder="buyer paypal" class="form-control"/>
            </div>
            <div class="mb-1 col-md-1">
                <label for="name">$ Rate 
                    <span class="badge badge-pill badge-soft-danger font-size-12 mt-3">${data[i].dollar_rate}</span>
                </label>
            </div>
            <div class="mb-1 col-md-2">
                <label for="name">Dollars</label>
                <span class="text-danger font-size-14">${data[i].total_short_dollars}</span>
                <input type="number" value="${dollars}" id="dollarTotal" name="dollarTotal[]" placeholder="0.00" class="form-control" readonly/>
            </div>
            <div class="mb-1 col-md-2">
                <label for="name">Use Dollar</label>
                <input type="number" max="${dollars}" onKeyUp="UseMaxValueOnly('${data[i].id}')" value="${useDollarAmount}" id="dollarUse${data[i].id}" step="any" name="dollarUse[]" pattern="[0-9]+([\.,][0-9]+)?" attrPkr="${data[i].pkr_amount}" attrDollars="${dollars}" title="Please enter only numeric values" placeholder="0.00" class="form-control dynamic-input"/>
                <span id="errorMessage${data[i].id}" style="color: red;"></span>
            </div>
            <div class="col-md-1 align-self-center mx-auto pt-4">
                <div class="d-grid">
                    <a href="javascript:void(0);" class="text-danger deletePriceRange">
                        <i class="mdi mdi-delete font-size-18"></i>
                    </a>
                </div>
            </div>
        `);

            // Add the item to the repeater list
            repeaterList.append(newItem);
            if (chk) {
                UseMaxValueOnly(data[i].id);
            }
            // Stop if no more amount needs to be allocated
            if (remainingOrderAmount <= 0) {
                break;
            }

        }

        // Optional: Notify the user if some amount couldn't be allocated
        if (remainingOrderAmount > 0) {
            alert('Not enough dollar amounts to cover the entire order amount.');
        }
    }

    function paymentpay_temp(cname, com_id, gmId, member_id, order_id, price, pkr, gmuId, dollar_rate, partialId) {
        $("#comNameId").text(cname);
        $("#dollar_pay_ab_com_id").val(com_id);
        $("#dollar_pay_ab_gm_id").val(gmId);
        $("#member_id").val(member_id);
        $("#order_id").val(order_id);
        $("#dollar").val(price);
        $("#gmuId").val(gmuId);
        $("#pkrAmountData").val(pkr);
        $("#comNameIdPkr").text(pkr);
        $("#comNameIdDollarrate").text(dollar_rate);
        fetchAvailablePriceRanges_temp(0, 500, price, 'checked');
        $('.cus_color').addClass('bg-warning');
        // Create a new input element
        $('#dollar_pay_ab_com_id').attr('name', 'add_tem_pay_to_check_it_show_in_ab'); // Change name attribute
        $('#dollar_pay_ab_com_id').attr('id', 'add_tem_pay_to_check_it_show_in_ab');
        $("#add_tem_pay_to_check_it_show_in_ab").val(com_id);

    }
    $(document).ready(function() {
        // Initialize the ionRangeSlider
        $('#pricerange').ionRangeSlider({
            type: 'double',
            min: 0,
            max: 500,
            from: 0,
            to: 100,
            skin: "square",
            grid: true,
            onFinish: function(data) {

                if ($('#add_tem_pay_to_check_it_show_in_ab').val()) {
                    // If the element exists, execute the functions
                    var add_tem_pay_to_check_it_show_in_ab = 'not-show';
                    fetchAvailablePriceRanges_temp(data.from, data.to, add_tem_pay_to_check_it_show_in_ab);
                    // console.log('temp');
                } else {
                    // Fetch available price ranges based on the slider values
                    fetchAvailablePriceRanges(data.from, data.to);
                    // console.log('availbel');
                }

            }
        });
    });


    // });


    function paymentpay(cname, com_id, gmId, member_id, order_id, price, pkr, gmuId, dollar_rate) {
        $("#comNameId").text(cname);
        $("#dollar_pay_ab_com_id").val(com_id);
        $("#dollar_pay_ab_gm_id").val(gmId);
        $("#member_id").val(member_id);
        $("#order_id").val(order_id);
        $("#dollar").val(price);
        $("#gmuId").val(gmuId);
        $("#pkrAmountData").val(pkr);
        $("#comNameIdPkr").text(pkr);
        $("#comNameIdDollarrate").text(dollar_rate);
        fetchAvailablePriceRanges(0, 500, price, 'checked');
        $('.cus_color').removeClass('bg-warning');
        $('#dollar_pay_ab_com_id').attr('name', 'dollar_pay_ab_com_id'); // Change name attribute
        $('#dollar_pay_ab_com_id').attr('id', 'dollar_pay_ab_com_id');
        var slider = $('#pricerange').data("ionRangeSlider"); // Get instance of the slider
        slider.update({
            disable: false // Disable the slider
        });
    }

    function UseMaxValueOnly(id) {
        var maxSum = Number($('#dollar').val()).toFixed(2);
        // Get the input element
        var inputElement = $('#dollarUse' + id);

        // Get the current value of the input
        var currentValue = $('#dollarUse' + id).val();
        var buyer_dollar_rate = $('#buyer_dollar_rate' + id).val();
        var attrPkr = (currentValue * buyer_dollar_rate).toFixed(0);
        $('#dollarUse' + id).attr('attrPkr', attrPkr);
        $('#dollarUse' + id).attr('attrDollars', currentValue);
        // Get the maximum allowed value
        var maxValue = parseFloat($('#dollarUse' + id).attr('max'));
        // Check if the current value exceeds the maximum
        if (currentValue > maxValue) {
            // Show an error message
            $('#errorMessage' + id).text('Dollars cannot exceed $' + maxValue);

            // Reset the input value to the maximum
            $('#dollarUse' + id).val(maxValue);
        } else {
            // Clear the error message
            $('#errorMessage' + id).text('');
        }
        var inputs = document.getElementsByClassName('dynamic-input');

        // Initialize sum
        var sum = 0;
        // Calculate the sum of all input values
        // Initialize Dollars and Pkr sum
        var AllUsedDollars = 0;
        var AllUsedPkrs = 0;
        for (var i = 0; i < inputs.length; i++) {
            sum += parseFloat(inputs[i].value) || 0;
            AllUsedDollars += parseFloat(inputs[i].getAttribute('attrDollars')) || 0;

            AllUsedPkrs += parseFloat(inputs[i].getAttribute('attrPkr')) || 0;
        }
        var pft_OR_loss = 0;
        var customDollarRate = (AllUsedPkrs / AllUsedDollars).toFixed(2);
        var CustomerPaidWebxlPkr = $('#pkrAmountData').val();
        var cusDollarRatePkr = Number(maxSum * customDollarRate).toFixed(0);
        var pkr_differ = CustomerPaidWebxlPkr - cusDollarRatePkr;
        if (pkr_differ > 0) {
            var pft_OR_loss_color = 'badge-soft-success';
            var pft_OR_loss = (pkr_differ / customDollarRate).toFixed(2);
        } else if (pkr_differ < 0) {
            var pft_OR_loss_color = 'badge-soft-danger';
            var pft_OR_loss = (pkr_differ / customDollarRate).toFixed(2);
        } else {
            var pft_OR_loss_color = 'badge-soft-warning';
            var pft_OR_loss = (pkr_differ / customDollarRate).toFixed(2);
        }
        // profitOrloss
        $('#customDollarRate').text(customDollarRate);
        $('#profitOrloss').text(pft_OR_loss);
        $('#profitOrloss').removeClass('badge-soft-danger').addClass(pft_OR_loss_color);
        $('#profitOrlossPker').text(AllUsedPkrs);
        // custom Dollar rate Profit Loss
        $('#cus_dollar_rate').val(customDollarRate);
        $('#cus_profit').val(pft_OR_loss);

        var remainTotalDollars = (maxSum - (sum.toFixed(2))).toFixed(2);
        $('#remainTotalDollars').text(remainTotalDollars);
        let totalShortSum = sum + 2991;
        console.log(totalShortSum);
        $('#short_sum').text(totalShortSum.toFixed(2));

        var f_Sum = sum.toFixed(2);
        if (parseFloat(f_Sum) > parseFloat(maxSum)) {
            $("#submitBtn").addClass("disabled");
            document.getElementById('errorMessage').innerText = 'Sum cannot exceed ' + maxSum;
            // console.log(f_Sum);
            // // Reset the input values to stay within the limit
            // for (var i = 0; i < inputs.length; i++) {
            //     inputs[i].value = Math.max(0, maxSum - sum + parseFloat(inputs[i].value) || 0);
            // }
        } else if (f_Sum == maxSum) {
            $("#submitBtn").removeClass("disabled");
        } else {
            document.getElementById('errorMessage').innerText = '';
            $("#submitBtn").addClass("disabled");
        }

    }
    $('[data-repeater-list="priceRanges"]').on('click', '.deletePriceRange', function() {
        if (confirm('Are you sure you want to delete this item?')) {
            var $itemToDelete = $(this).closest('[data-repeater-item]').remove();

            // Perform animation before deleting
            $itemToDelete.slideUp('fast', function() {
                $(this).remove();

                updateRepeaterNames();
            });
        }


    });
    $(document).ready(function() {
        $('#selectAll').change(function() {
            if ($(this).is(':checked')) {
                $('[data-repeater-item]').show();
            } else {
                $('[data-repeater-item]').each(function() {
                    if (!$(this).find('input[type="checkbox"]').is(':checked')) {
                        $(this).remove();

                    }
                });
                // $(this).prop('checked', true);
            }
        });
    });
    $(document).ready(function() {
        $("#form_gm_acc").on("submit", function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            swal({
                    title: "Are you sure to pay alibaba",
                    text: "",
                    icon: "warning",
                    buttons: true,
                    dangerMode: true,
                })
                .then((willDelete) => {
                    if (willDelete) {
                        $.ajax({
                            type: 'post',
                            url: 'layouts/func.php',
                            async: false,
                            data: formData,
                            contentType: false,
                            processData: false,
                            success: function(data) {

                                swal("Poof! You successfully pay!", {
                                    icon: "success",
                                });
                                loadPage(1);
                                loadPage2(1);
                                $("#closeBtn").click();
                            }

                        });

                    } else {
                        swal("function close!");
                    }
                });

        });
    });


    $(document).ready(function() {
        $("#pay_ab_update_status").on("submit", function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            swal({
                    title: "Are you sure to update ab paid status",
                    text: "",
                    icon: "warning",
                    buttons: true,
                    dangerMode: true,
                })
                .then((willDelete) => {
                    if (willDelete) {
                        $.ajax({
                            type: 'post',
                            url: 'layouts/func.php',
                            async: false,
                            data: formData,
                            contentType: false,
                            processData: false,
                            success: function(data) {
                                // console.log(data);
                                swal("Poof! You successfully updated!", {
                                    icon: "success",
                                });
                                loadPage2(1);
                            }

                        });

                    } else {
                        swal("function close!");
                    }
                });

        });
    });

    // alibaba payed customer


    $(document).ready(function() {
        loadPage2(1);

        $('#searchInput2').on('input', function() {
            loadPage2(1, $('#searchInput2').val(), $('#fromDate2').val(), $('#toDate2').val());
        });

        $('#fromDate2, #toDate2').on('change', function() {
            loadPage2(1, $('#searchInput2').val(), $('#fromDate2').val(), $('#toDate2').val());
        });

        $('#clearFilter2').click(function() {
            $('#searchInput2').val('');
            $('#fromDate2').val('');
            $('#toDate2').val('');
            loadPage2(1);
        });

        $(document).on('click', '.pagination2 a', function() {
            var page = $(this).data('page');
            if (page !== undefined && page !== '') {
                loadPage2(page, $('#searchInput2').val(), $('#fromDate2').val(), $('#toDate2').val());
            }
        });

        $('#prevPage2').click(function() {
            var currentPage = parseInt($('#pageNumbers2 .active').data('page'));
            if (currentPage > 1) {
                loadPage2(currentPage - 1, $('#searchInput2').val(), $('#fromDate2').val(), $('#toDate2').val());
            }
        });

        $('#nextPage2').click(function() {
            var currentPage = parseInt($('#pageNumbers2 .active').data('page'));
            var totalPages = parseInt($('#pageNumbers2').data('total-pages'));
            if (currentPage < totalPages) {
                loadPage2(currentPage + 1, $('#searchInput2').val(), $('#fromDate2').val(), $('#toDate2').val());
            }
        });
    });

    function loadPage2(page, search = '', fromDate = '', toDate = '') {
        $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            data: {
                page_dollar_gm2: page,
                search: search,
                fromDate2: fromDate,
                toDate2: toDate
            },
            dataType: 'json',
            success: function(data) {
                displayData2(data, search, page);
                displayPagination2(data.totalPages, page);
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }

    function displayData2(datas, search, page) {
        // Store current data for export
        currentTableData = datas;
        // console.log('Current data ' + JSON.stringify(datas));

        // Clear previous data
        $('#showdata2').empty();
        var num = ((page - 1) * 20) + 0;
        var itemsContainer = $('#showdata2');
        var data = datas.records;
        var profit_loss = '';
        var totalDollarsPay = 0;
        var totalCurrentDollarsPayProfit = 0;
        var totalCurrentDollarsPayLoss = 0;
        var totalcus_profitPayProfit = 0;
        var totalcus_profitPayLoss = 0;
        var total_extra_disc = parseFloat('0.00');
        var extra_discount = '';


        for (var i = 0; i < data.length; i++) {
            let currentDate = new Date(data[i].pay_date);
            var day = currentDate.getDate();
            var month = currentDate.getMonth() + 1; // Months are zero-based
            var year = currentDate.getFullYear();
            let type = typeof(data[i].cname);

            if (data[i].pay_status == 'paid') {
                var pay_status_color = 'success';
            } else if (data[i].pay_status == 'refund') {
                var pay_status_color = 'warning';
            } else if (data[i].pay_status == 'processing') {
                var pay_status_color = 'danger';
            } else {
                var pay_status_color = '';
            }

            var customer_dollar_rate = data[i].customer_dollar_rate;
            var customer_dollars = data[i].price;
            var pay_dollar_rate = data[i].dollar_rate;
            var pay_dollars = data[i].dollars;
            var customer_pkr = customer_dollars * customer_dollar_rate;
            var pay_pkr = pay_dollars * pay_dollar_rate;
            var dollar_rate_difference = (parseInt(customer_dollar_rate) - parseInt(pay_dollar_rate));
            var pkr_difference = customer_pkr - pay_pkr;

            if (pkr_difference > 0) {
                var dollar_rate_color = 'success';
                var profit_loss = (customer_pkr - pay_pkr) / pay_dollar_rate;
                var profit = 'Profit';
                totalCurrentDollarsPayProfit = parseFloat(totalCurrentDollarsPayProfit + profit_loss);
            } else if (pkr_difference < 0) {
                var dollar_rate_color = 'danger';
                var profit_loss = (customer_pkr - pay_pkr) / pay_dollar_rate;
                var profit = 'Loss';
                totalCurrentDollarsPayLoss = parseFloat(totalCurrentDollarsPayLoss + profit_loss);
            } else {
                var dollar_rate_color = 'warning';
                var profit_loss = (customer_pkr - pay_pkr) / pay_dollar_rate;
                var profit = 'Equal';
            }

            totalDollarsPay = parseInt(totalDollarsPay) + parseInt(data[i].dollars);
            var cust_dollar_pay = parseFloat(data[i].cus_profit);

            if (cust_dollar_pay > 0) {
                totalcus_profitPayProfit = parseFloat(totalcus_profitPayProfit + cust_dollar_pay);
            } else if (cust_dollar_pay < 0) {
                totalcus_profitPayLoss = parseFloat(totalcus_profitPayLoss + cust_dollar_pay);
            } else {
                totalcus_profitPayProfit = 0;
                totalcus_profitPayLoss = 0;
            }

            if (!isNaN(data[i].extra_discount) && isFinite(data[i].extra_discount) && !(data[i].extra_discount == '')) {
                extra_discount = parseFloat(data[i].extra_discount);
            } else {
                extra_discount = parseFloat('0.00');
            }
            total_extra_disc = parseFloat(total_extra_disc + extra_discount);

            function formatDateToMDY(dateStr) {
                if (!dateStr) return '';

                const date = new Date(dateStr);
                if (isNaN(date)) return dateStr;

                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const year = date.getFullYear();

                return `${month}/${day}/${year}`;
            }


            var formattedDate =
                String(month).padStart(2, '0') + '/' +
                String(day).padStart(2, '0') + '/' +
                year;

            num++;

            var gmDate = new Date(data[i].gm_bvDate);
            var currentYear = new Date().getFullYear();
            var isOldDate = gmDate.getFullYear() !== currentYear;
            var formatted = formatDateToMDY(data[i].gm_bvDate);

            var formatted = formatDateToMDY(data[i].gm_bvDate);
            let pagenation_data = '<tr>';
            pagenation_data += '<td><div class="form-check ">';
            pagenation_data += '' + num + '';
            pagenation_data += '<input class="form-check-input" type="checkbox" value="' + data[i].id + '" id="' + data[i].id + '"><label class="form-check-label" for="' + data[i].id + '"></label></div></td>';
            pagenation_data += '<td>' + formattedDate + '</td>';
            if (isOldDate) {
                pagenation_data += '<td><span class="badge bg-danger">' + formatted + '</span></td>';
            } else {
                pagenation_data += '<td>' + formatted + '</td>';
            }
            pagenation_data += '<td><a href="javascript:void(0)" fw-bold">' + data[i].com_id + '</a> </td>';
            pagenation_data += '<td><a href="javascript:void(0)" fw-bold">' + data[i].member_id + '</a> </td>';
            pagenation_data += '<td><a href="javascript:void(0)" fw-bold">' + data[i].order_id + '</a> </td>';
            pagenation_data += '<td href="javascript:void(0)">' + data[i].cname + '</td>';
            pagenation_data += '<td>' + data[i].name + '</td>';
            pagenation_data += '<td>$ ' + data[i].dollars + '</td>';
            pagenation_data += '<td>' + data[i].dollar_rate + '</td>';
            pagenation_data += '<td>' + data[i].package + '</td>';
            pagenation_data += '<td>' + data[i].type + '</td>';
            pagenation_data += '<td>' + extra_discount + '</td>';
            pagenation_data += '<td><span class="badge badge-pill badge-soft-' + pay_status_color + ' font-size-11">' + data[i].pay_status + '</span></td>';
            pagenation_data += '<td><span class="badge badge-pill badge-soft-' + dollar_rate_color + ' font-size-11">' + profit + ': $ ' + profit_loss.toFixed(2) + '</span></td>';
            pagenation_data += '<td>' + data[i].cus_dollar_rate + '</td>';
            pagenation_data += '<td>' + data[i].cus_profit + '</td>';
            pagenation_data += '<td><a href="javascript:void(0)" onclick="payDollarsDetail(\'' + data[i].cname + '\',\'' + data[i].com_id + '\',\'' + data[i].gmid + '\',\'' + data[i].member_id + '\',\'' + data[i].order_id + '\',\'' + data[i].dollars + '\',\'' + data[i].dollar_rate + '\',\'' + data[i].payid + '\',\'' + profit + '\',\'' + profit_loss.toFixed(2) + '\')" class="btn btn-primary btn-sm btn-rounded" data-bs-toggle="modal" data-bs-target=".orderdetailsModal">View Details</a></td>';
            pagenation_data += '<td><div class="d-flex gap-1">';

            if (data[i].pay_status != "paid") {
                pagenation_data += '<a href="javascript:void(0)" onclick="payDollarsDetail2(\'' + data[i].cname + '\',\'' + data[i].gmid + '\',\'' + data[i].member_id + '\',\'' + data[i].order_id + '\',\'' + data[i].payid + '\')"  data-bs-toggle="modal" data-bs-target=".orderdetailsModal3"><button type="button" style="height:1.5rem; width:1.5rem;" class="btn btn-primary position-relative p-0 avatar-xs rounded-circle" title="Payment Verify">';
                pagenation_data += '<span class="avatar-title bg-transparent text-reset"><i class="bx bxs-edit"></i></span></button></a>';
            }
            if (isOldDate) {
                pagenation_data += '<a href="javascript:void(0)" onclick="viewOldDateDetail(\'' + data[i].gmid + '\', \'' + formatted + '\',\'' + data[i].com_id + '\',\'' + data[i].member_id + '\',\'' + data[i].cname + '\',\'' + data[i].userbvdate + '\',\'' + data[i].gmbvid + '\')" data-bs-toggle="modal" data-bs-target="#oldDateModal">';
                pagenation_data += '<button type="button" style="height:1.5rem; width:1.5rem;" class="btn btn-warning position-relative p-0 avatar-xs rounded-circle" title="View Details">';
                pagenation_data += '<span class="avatar-title bg-transparent text-reset"><i class="bx bx-show"></i></span></button></a>';
            }


            pagenation_data += '</td></tr>';
            itemsContainer.append(pagenation_data);
        }

        // Store totals for export
        currentTableTotals = {
            totalDollarsPay: totalDollarsPay,
            totalCurrentDollarsPayProfit: totalCurrentDollarsPayProfit,
            totalCurrentDollarsPayLoss: totalCurrentDollarsPayLoss,
            totalcus_profitPayProfit: totalcus_profitPayProfit,
            totalcus_profitPayLoss: totalcus_profitPayLoss,
            total_extra_disc: total_extra_disc
        };
        var grandTotal = 0;

        // SAFE check (no error if missing)
        if (datas.grandTotals && datas.grandTotals.total_amount) {
            grandTotal = parseFloat(datas.grandTotals.total_amount);
        }

        var itemsContainerFooter = $('#showdata2Fotter');
        showdata2Fotter = '<tr>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th><span class="badge badge-pill badge-soft-secondary font-size-12">Total: ' + totalDollarsPay.toFixed(2) + '</span>' +
            '<span class="badge badge-pill badge-soft-primary font-size-12">Grand: ' + grandTotal.toLocaleString() + '</span></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th><span class="badge badge-pill badge-soft-warning font-size-12">Extra Disc: ' + total_extra_disc.toFixed(2) + '</span> </th>';
        showdata2Fotter += '<th><span class="badge badge-pill badge-soft-success font-size-12">Profit: ' + totalCurrentDollarsPayProfit.toFixed(2) + '</span> </th>';
        showdata2Fotter += '<th><span class="badge badge-pill badge-soft-danger font-size-12">Loss: ' + totalCurrentDollarsPayLoss.toFixed(2) + '</span></th>';
        showdata2Fotter += '<th><span class="badge badge-pill badge-soft-success font-size-12">Cus Profit: ' + totalcus_profitPayProfit.toFixed(2) + '</span> </th>';
        showdata2Fotter += '<th><span class="badge badge-pill badge-soft-danger font-size-12">Cus Loss: ' + totalcus_profitPayLoss.toFixed(2) + '</span></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '<th></th>';
        showdata2Fotter += '</tr>';
        itemsContainerFooter.html(showdata2Fotter);

        $("#showdata2Fotter3").text(totalCurrentDollarsPayProfit.toFixed(2));
        $("#showdata2Fotter4").text(totalCurrentDollarsPayLoss.toFixed(2));
        $("#showdata2Fotter5").text(totalcus_profitPayProfit.toFixed(2));
        $("#showdata2Fotter6").text(totalcus_profitPayLoss.toFixed(2));
        $("#showdata2Fotter7").text(total_extra_disc.toFixed(2));
    }

    function displayPagination2(totalPages, currentPage) {
        $('#pageNumbers2').empty();

        var startPage = Math.max(currentPage - 2, 1);
        var endPage = Math.min(currentPage + 1, totalPages);

        if (startPage > 1) {
            $('#pageNumbers2').append('<li class="page-item"><a href="javascript:void(0);" class="page-link" data-page="1">1</a></li>');
            if (startPage > 3) {
                $('#pageNumbers2').append('<span class="ellipsis">...</span>');
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            var activeClass = (i === currentPage) ? 'active' : '';
            $('#pageNumbers2').append('<li class="page-item ' + activeClass + '"><a href="javascript:void(0);" class="page-link ' + activeClass + '" data-page="' + i + '">' + i + '</a></li>');
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                $('#pageNumbers2').append('<span class="ellipsis">...</span>');
            }
            $('#pageNumbers2').append('<li class="page-item"><a href="javascript:void(0);" class="page-link"  data-page="' + totalPages + '">' + totalPages + '</a></li>');
        }

        $('#pageNumbers2').data('total-pages', totalPages);
    }

    function viewCuurentQueDetail(param1, param2, start, end, status, param6) {

    }

    document.getElementById('searchInput2').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const tableRows = document.querySelectorAll('#showdata2 tr');

        tableRows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });

    document.getElementById('checkAll').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#showdata2 input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });

    document.addEventListener('DOMContentLoaded', function() {
        const exportBtn = document.querySelector('button[onclick="exportToExcel()"]');
        if (exportBtn) {
            exportBtn.addEventListener('mouseover', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            });

            exportBtn.addEventListener('mouseout', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
        }
    });

    function displayPagination2(totalPages, currentPage) {
        $('#pageNumbers2').empty();

        var startPage = Math.max(currentPage - 2, 1);
        var endPage = Math.min(currentPage + 1, totalPages);

        if (startPage > 1) {
            $('#pageNumbers2').append('<li class="page-item"><a href="javascript:void(0);" class="page-link" data-page="1">1</a></li>');
            if (startPage > 3) {
                $('#pageNumbers2').append('<span class="ellipsis">...</span>');
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            var activeClass = (i === currentPage) ? 'active' : '';
            $('#pageNumbers2').append('<li class="page-item ' + activeClass + '"><a href="javascript:void(0);" class="page-link ' + activeClass + '" data-page="' + i + '">' + i + '</a></li>');
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                $('#pageNumbers2').append('<span class="ellipsis">...</span>');
            }
            $('#pageNumbers2').append('<li class="page-item"><a href="javascript:void(0);" class="page-link"  data-page="' + totalPages + '">' + totalPages + '</a></li>');
        }

        $('#pageNumbers2').data('total-pages', totalPages);
    }

    function viewCuurentQueDetail(param1, param2, start, end, status, param6) {
        console.log('Filtering data with parameters:', param1, param2, start, end, status, param6);
    }

    document.getElementById('searchInput2').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const tableRows = document.querySelectorAll('#showdata2 tr');

        tableRows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });

    document.getElementById('checkAll').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#showdata2 input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });

    document.addEventListener('DOMContentLoaded', function() {
        const exportBtn = document.querySelector('button[onclick="exportToExcel()"]');
        if (exportBtn) {
            exportBtn.addEventListener('mouseover', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            });

            exportBtn.addEventListener('mouseout', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
        }
    });


    function displayPagination2(totalPages, currentPage) {
        $('#pageNumbers2').empty();

        var startPage = Math.max(currentPage - 2, 1);
        var endPage = Math.min(currentPage + 1, totalPages);

        if (startPage > 1) {
            $('#pageNumbers2').append('<li class="page-item"><a href="javascript:void(0);" class="page-link" data-page="1">1</a></li>');
            if (startPage > 3) {
                $('#pageNumbers2').append('<span class="ellipsis">...</span>');
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            var activeClass = (i === currentPage) ? 'active' : '';
            $('#pageNumbers2').append('<li class="page-item ' + activeClass + '"><a href="javascript:void(0);" class="page-link ' + activeClass + '" data-page="' + i + '">' + i + '</a></li>');
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                $('#pageNumbers2').append('<span class="ellipsis">...</span>');
            }
            $('#pageNumbers2').append('<li class="page-item"><a href="javascript:void(0);" class="page-link"  data-page="' + totalPages + '">' + totalPages + '</a></li>');
        }

        $('#pageNumbers2').data('total-pages', totalPages);
    }

    function viewCuurentQueDetail(param1, param2, start, end, status, param6) {
        console.log('Filtering data with parameters:', param1, param2, start, end, status, param6);
    }

    document.getElementById('searchInput2').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const tableRows = document.querySelectorAll('#showdata2 tr');

        tableRows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });

    document.getElementById('checkAll').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#showdata2 input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });

    document.addEventListener('DOMContentLoaded', function() {
        const exportBtn = document.querySelector('button[onclick="exportToExcel()"]');
        if (exportBtn) {
            exportBtn.addEventListener('mouseover', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            });

            exportBtn.addEventListener('mouseout', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
        }
    });

    // end dollar gm
    function payDollarsDetail(cname, com_id, gmId, member_id, order_id, dollars, dollar_rate, payid, profit_text, profit_value) {
        $("#order_cname").text(cname);
        $("#order_mid").text(member_id);
        $("#order_oid").text(order_id);
        $("#order_dollar").text(dollars);
        $("#order_dollar_rate").text(dollar_rate);
        $("#order_text").text(profit_text + ':');
        $("#order_text_value").text(profit_value);
        BuyerAllDetails(payid);
        $("#showConfirmBtn").hide();
        $("#AddMoreShorForTemp").hide();
    }
    // end dollar gm
    function payDollarsDetail2(cname, gmId, member_id, order_id, payid) {
        $("#comNameId2").text(cname);
        $("#dollar_pay_ab_gm_id2").val(gmId);
        $("#member_id2").val(member_id);
        $("#order_id2").val(order_id);
        $("#payid2").val(payid);
    }

    function viewOldDateDetail(gmid, bvDate, com_id, member_id, cname, userbvdate, gmbvid) {
        document.getElementById("modal_gmid").value = gmid;
        document.getElementById("modal_com_id").value = com_id;
        document.getElementById("modal_member_id").value = member_id;
        document.getElementById("modal_cname").value = cname;
        document.getElementById("modal_gmbvid").value = gmbvid;
        document.getElementById("modal_userbvdate").value = userbvdate;

        let parts = bvDate.split('/');
        let formattedDate = parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');

        document.getElementById("modal_bvdate").value = formattedDate;

        updateStartEndDate(formattedDate);
    }

    function updateStartEndDate(bvDate) {
        console.log("updateStartEndDate called with:", bvDate);

        if (!bvDate) {
            console.log("No date provided");
            return;
        }

        document.getElementById("modal_start_date").value = bvDate;

        let d = new Date(bvDate);
        console.log("Date object:", d);

        d.setFullYear(d.getFullYear() + 1);
        let endDate = d.toISOString().split('T')[0];

        console.log("End date calculated:", endDate);

        document.getElementById("modal_end_date").value = endDate;
    }

    function BuyerAllDetails(payid) {
        $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            data: {
                payId_buyerDetail: payid
            },
            dataType: 'json',
            success: function(data) {
                displayData3(data);
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }

    function displayData3(datas) {
        // Clear previous data
        $('#buyerDetails').empty();
        var num = 0;
        var itemsContainer = $('#buyerDetails');
        var data = JSON.parse(datas);
        console.log(data);
        var profit_loss = '';

        for (var i = 0; i < data.length; i++) {
            num++;

            let pagenation_data = '<tr><th scope="row">';
            pagenation_data += '<div>' + num + '</div></th>';
            pagenation_data += '<td><div><h5 class="text-truncate font-size-14">' + data[i].buyer_main_name + '</h5>';
            pagenation_data += '<p class="text-muted mb-0">' + data[i].buyer_paypal_email + '</p>';
            pagenation_data += '<p class="text-muted mb-0">Total: <span class="text-primary">$ ' + data[i].dollarTotal + '</span>   Rate:<span class="text-primary"> ' + data[i].buyer_dollar_rate + '</span></p></td>';
            pagenation_data += '</div></td>';
            pagenation_data += '<td>$ ' + data[i].dollarUse + '</td>';
            pagenation_data += '<td>$ ' + (data[i].dollarTotal - data[i].dollarUse) + '</td></tr>';
            itemsContainer.append(pagenation_data);

        }
    }

    // end not show dollars
    function ShowDollarsAb(buyerName, paypalEmail, id, dollar_slot_id) {
        $("#mainDollarBuyer").text(buyerName);
        $("#not_show_paypal_id").val(paypalEmail);
        $("#dollar_buy_id_not_show").val(id);
        $("#dollar_slot_id").val(dollar_slot_id);
    }
    $(document).ready(function() {
        $("#pay_ab_update_status_not_show").on("submit", function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            swal({
                    title: "Are you sure to update ab dollar status",
                    text: "",
                    icon: "warning",
                    buttons: true,
                    dangerMode: true,
                })
                .then((willDelete) => {
                    if (willDelete) {
                        $.ajax({
                            type: 'post',
                            url: 'layouts/func.php',
                            async: false,
                            data: formData,
                            contentType: false,
                            processData: false,
                            success: function(data) {
                                console.log(data);
                                swal("Poof! You successfully updated!", {
                                    icon: "success",
                                });
                                $("#fullPage").load(" #fullPage");

                            }

                        });

                    } else {
                        swal("function close!");
                    }
                });

        });
    });


    // partial payment
    // partial payment
    $(document).ready(function() {
        // Initial load on page load
        loadPage5(1);
    });

    $(document).ready(function() {
        // Initial load on page load
        loadPage5(1);

        // Handle search input
        $('#searchInput5').on('input', function() {
            loadPage5(1, $(this).val(), $('#fromDate5').val(), $('#toDate5').val());
        });

        // Handle date range
        $('#fromDate5, #toDate5').on('change', function() {
            loadPage5(1, $('#searchInput5').val(), $('#fromDate5').val(), $('#toDate5').val());
        });

        // Clear filter
        $('#clearFilter5').on('click', function() {
            $('#searchInput5').val('');
            $('#fromDate5').val('');
            $('#toDate5').val('');
            loadPage5(1, '', '', '');
        });

        // Pagination link click event
        $(document).on('click', '.pagination5 a', function() {
            var page = $(this).data('page');
            if (page !== undefined && page !== '') {
                loadPage5(page, $('#searchInput5').val(), $('#fromDate5').val(), $('#toDate5').val());
            }
        });
    });

    function ViewInstallMents(comId) {
        loadPage5(comId, $('#searchInput5').val(), $('#fromDate5').val(), $('#toDate5').val());
    }

    function loadPage5(page, search = '', fromDate = '', toDate = '') {
        $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            data: {
                page_dollar_gm5: page,
                search: search,
                fromDate5: fromDate,
                toDate5: toDate
            },
            dataType: 'json',
            success: function(data) {
                displayData5(data, search);

                // Display pagination links
                displayPagination5(data.totalPages, page);
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }

    function displayData5(datas, search) {
        // Clear previous data
        $('#showdata5').empty();
        var num = 0;
        var itemsContainer = $('#showdata5');
        var data = datas.records;
        var renwal = '';
        var droupout = '';
        var totalD = 0;
        for (var i = 0; i < data.length; i++) {
            let currentDate = new Date(data[i].current_pay_date);
            var day = currentDate.getDate();
            var month = currentDate.getMonth() + 1; // Months are zero-based
            var year = currentDate.getFullYear();
            let type = typeof(data[i].cname);
            if (data[i].renwal == 1) {
                var renwal = 'New';
            } else if (data[i].renwal == 0) {
                var renwal = 'Rc';
            } else if (data[i].renwal == 2) {
                var renwal = 'Ec';
            } else {
                var renwal = 'None';
            }
            if (data[i].droupout == 1) {
                var droupout = 'Basic Drop';
            } else if (data[i].droupout == 2) {
                var droupout = 'Basic Plus Drop';
            } else if (data[i].droupout == 3) {
                var droupout = 'Basic P/D';
            } else if (data[i].droupout == 4) {
                var droupout = 'Basic Plus P/D';
            } else if (data[i].droupout == 5) {
                var droupout = 'Pkg Update';
            } else {
                var droupout = 'None';
            }
            totalD = totalD + data[i].current_dollar_pay;
            var formattedDate = year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
            num++;
            let pagenation_data = '<tr>';
            pagenation_data += '<td><div class="form-check ">';
            pagenation_data += '' + num + '';
            pagenation_data += '<label class="form-check-label" for="' + data[i].id + '"></label></div></td>';
            pagenation_data += '<td><a href="#createMeating" onclick="fun(\'' + data[i].cname + '\',\'' + data[i].id + '\');" class="popup-form text-body fw-bold">' + data[i].com_id + '</a> </td>';
            pagenation_data += '<td>' + formattedDate + '</td>';
            pagenation_data += '<td>' + data[i].gm_bvDate + '</td>';
            pagenation_data += '<td href="#createMeating" class="open-popup">' + data[i].cname + '</td>';
            pagenation_data += '<td>' + data[i].name + '</td>';
            pagenation_data += '<td>' + data[i].price + '</td>';
            pagenation_data += '<td>' + data[i].amount + '</td>';
            pagenation_data += '<td>' + data[i].dollar_rate + '</td>';
            pagenation_data += '<td>' + data[i].current_dollar_pay + '</td>';
            pagenation_data += '<td>' + data[i].current_dollar_rate + '</td>';
            pagenation_data += '<td>' + data[i].current_pkr + '</td>';
            pagenation_data += '<td>' + data[i].cash_status + '</td>';
            pagenation_data += '<td>' + data[i].package + '</td>';
            pagenation_data += '<td><span class="badge badge-pill badge-soft-success font-size-11">' + renwal + '</span></td>';
            pagenation_data += '<td>' + droupout + '</td>';
            pagenation_data += '<td>' + data[i].status + '</td>';
            pagenation_data += '<td><div class="d-flex gap-1">';
            pagenation_data += '<a href="javascript:void(0)" onclick="paymentpay2(\'' + data[i].cname + '\',\'' + data[i].vfy_gm_com_id + '\',\'' + data[i].gmId + '\',\'' + data[i].member_id + '\',\'' + data[i].order_id + '\',\'' + data[i].current_dollar_pay + '\',\'' + data[i].current_pkr + '\',\'' + data[i].gmuId + '\',\'' + data[i].partial_gm_id + '\',\'' + data[i].dollar_rate + '\')" data-bs-toggle="modal" data-bs-target=".orderdetailsModal2"><button type="button" style="height:1.5rem; width:1.5rem;" class="btn btn-primary position-relative p-0 avatar-xs rounded-circle" title="Pay To Ab">';
            pagenation_data += '<span class="avatar-title bg-transparent text-reset"><i class="bx bxs-dollar-circle"></i></span></button></a>';
            pagenation_data += '<a href="javascript:void(0)" onclick="paymentpay_temp(\'' + data[i].cname + '\',\'' + data[i].vfy_gm_com_id + '\',\'' + data[i].gmId + '\',\'' + data[i].member_id + '\',\'' + data[i].order_id + '\',\'' + data[i].current_dollar_pay + '\',\'' + data[i].current_pkr + '\',\'' + data[i].gmuId + '\',\'' + data[i].dollar_rate + '\',\'' + data[i].partial_gm_id + '\')" data-bs-toggle="modal" data-bs-target=".orderdetailsModal2"><button type="button" style="height:1.5rem; width:1.5rem;" class="btn btn-warning position-relative p-0 avatar-xs rounded-circle" title="Pay Temp Payment">';
            pagenation_data += '<span class="avatar-title bg-transparent text-reset"><i class="bx bx-info-circle"></i></span></button></a>';
            pagenation_data += '</tr>';
            itemsContainer.append(pagenation_data);

        }

    }


    // $('.cus_color').addClass('bg-warning');
    // // Create a new input element
    //     $('#dollar_pay_ab_com_id').attr('name', 'add_tem_pay_to_check_it_show_in_ab'); // Change name attribute
    //     $('#dollar_pay_ab_com_id').attr('id', 'add_tem_pay_to_check_it_show_in_ab');
    //   $("#add_tem_pay_to_check_it_show_in_ab").val(com_id);
    // end dollar gm
    function paymentpay2(cname, com_id, gmId, member_id, order_id, price, pkr, gmuId, partial_gm_id, dollar_rate) {
        $("#comNameId").text(cname);
        $("#dollar_pay_ab_com_id").val(com_id);
        $("#dollar_pay_ab_gm_id").val(gmId);
        $("#member_id").val(member_id);
        $("#order_id").val(order_id);
        $("#dollar").val(price);
        $("#gmuId").val(gmuId);
        $("#pkrAmountData").val(pkr);
        $("#comNameIdPkr").text(pkr);
        $("#comNameIdDollarrate").text(dollar_rate);
        var newInput = $('<input type="hidden" name="partial_gm_id" id="partial_gm_id" value="' + partial_gm_id + '">');
        $('#formNewInput').append(newInput);
        $('#dollar_pay_ab_com_id').attr('name', 'dollar_pay_ab_com_id'); // Change name attribute
        $('#dollar_pay_ab_com_id').attr('id', 'dollar_pay_ab_com_id');
        $('.cus_color').removeClass('bg-warning');
        fetchAvailablePriceRanges(0, 500, price, 'checked');
        var slider = $('#pricerange').data("ionRangeSlider"); // Get instance of the slider
        slider.update({
            disable: false // Disable the slider
        });
    }


    function viewCuurentQueDetail(fAll, tAll, start, end, paymentStatus, extraDisc) {

        $.ajax({
            type: 'post',
            url: 'layouts/func.php',
            data: {
                type_fillter_pay_ab: fAll,
                payment_status_pay_ab: paymentStatus,
                payment_status_type: tAll,
                startData: start,
                endData: end,
                extraDisc: extraDisc
            },
            success: function(data) {
                // $('#showSearchdata').fadeIn();
                $('#payment_received2').html(data);
            }

        });
    };


    $(document).ready(function() {
        $('body').addClass('sidebar-enable vertical-collpsed');

    });

    $(document).ready(function() {
        function generateTitle() {
            return "Partial Payment Received";
        }
        $("#datatable").DataTable({
            dom: "Bfrtip",
            searching: true,
            paging: false,
            ordering: false,
            buttons: [{
                    extend: "copyHtml5",
                    footer: true,
                    filename: function() {
                        return "partial_payment_received_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                },
                {
                    extend: "excelHtml5",
                    footer: true,
                    filename: function() {
                        return "partial_payment_received_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                },
                {
                    extend: "csvHtml5",
                    footer: true,
                    filename: function() {
                        return "partial_payment_received_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                },
                {
                    extend: "pdfHtml5",
                    footer: true,
                    filename: function() {
                        return "partial_payment_received_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                }
            ]
        });
        $(".btn-group, .btn-group-vertical").css("float", "left");
    });
    $(document).ready(function() {
        function generateTitle() {
            return "Pending Approvals";
        }
        $("#datatable-buttons-new").DataTable({
            dom: "Bfrtip",
            searching: true,
            paging: false,
            ordering: false,
            buttons: [{
                    extend: "copyHtml5",
                    footer: true,
                    filename: function() {
                        return "pending_approvals_gm_list_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                },
                {
                    extend: "excelHtml5",
                    footer: true,
                    filename: function() {
                        return "pending_approvals_gm_list_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                },
                {
                    extend: "csvHtml5",
                    footer: true,
                    filename: function() {
                        return "pending_approvals_gm_list_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                },
                {
                    extend: "pdfHtml5",
                    footer: true,
                    filename: function() {
                        return "pending_approvals_gm_list_" + new Date().toISOString().slice(0, 10);
                    },
                    title: function() {
                        return generateTitle();
                    }
                }
            ]
        });
        $(".btn-group, .btn-group-vertical").css("float", "left");
    });







    // Loan Payment Code
    $(document).ready(function() {
        loadPage_loan(1);
        $('#searchInput_loan').on('input', function() {
            loadPage_loan(1, $(this).val());
        });
        $(document).on('click', '.pagination_loan a', function() {
            var page = $(this).data('page_loan');
            if (page !== undefined && page !== '') {
                loadPage_loan(page, $('#searchInput_loan').val());
            }
        });

        $('#prevPage_loan').click(function() {
            var currentPage = parseInt($('#pageNumbers_loan .active').data('page_loan'));
            if (currentPage > 1) {
                loadPage_loan(currentPage - 1);
            }
        });

        $('#nextPage_loan').click(function() {
            var currentPage = parseInt($('#pageNumbers_loan .active').data('page_loan'));
            var totalPages = parseInt($('#pageNumbers_loan').data('total-pages_loan'));
            if (currentPage < totalPages) {
                loadPage_loan(currentPage + 1);
            }
        });
    });

    function loadPage_loan(page, search = '') {
        $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            data: {
                page_dollar_gm_loan: page,
                search: search
            },
            dataType: 'json',
            success: function(data) {
                console.log(data);
                displayData_loan(data, search, page);

                // Display pagination links
                displayPagination_loan(data.totalPages, page);
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }
    let updateprice = 0;

    function displayData_loan(datas, search, page) {
        // Clear previous data
        var NC = 0;
        var RC = 0;
        var EC = 0;
        $('#showdata_loan').empty();
        var num = ((page - 1) * 10) + 0;
        var itemsContainer = $('#showdata_loan');
        var data = datas.records;
        var renwal = '';
        var droupout = '';
        for (var i = 0; i < data.length; i++) {
            let currentDate = new Date(data[i].create_date);
            var day = currentDate.getDate();
            var month = currentDate.getMonth() + 1; // Months are zero-based
            var year = currentDate.getFullYear();
            let type = typeof(data[i].cname);
            if (data[i].renwal == 1) {
                var renwal = 'New';
                NC++;
                var color = 'bg-success';
            } else if (data[i].renwal == 0) {
                var renwal = 'Rc';
                RC++;
                var color = 'bg-info';
            } else if (data[i].renwal == 2) {
                var renwal = 'Ec';
                EC++;
                var color = 'bg-danger';
            } else {
                var renwal = 'None';
            }
            if (data[i].droupout == 1) {
                var droupout = 'Basic Drop';
            } else if (data[i].droupout == 2) {
                var droupout = 'Basic Plus Drop';
            } else if (data[i].droupout == 3) {
                var droupout = 'Basic P/D';
            } else if (data[i].droupout == 4) {
                var droupout = 'Basic Plus P/D';
            } else if (data[i].droupout == 5) {
                var droupout = 'Pkg Update';
            } else {
                var droupout = 'None';
            }
            if (data[i].acc_pay_status == 'Customer Paid') {
                var price = data[i].extra_discount;
                var amount = data[i].extra_pkr_discount;
            } else {
                var price = data[i].price;
                var amount = data[i].amount;
            }

            var formattedDate = year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
            num++;
            let pagenation_data = '<tr>';
            pagenation_data += '<td><div class="form-check ">';
            pagenation_data += '' + num + '';
            pagenation_data += '<label class="form-check-label" for="' + data[i].id + '"></label></div></td>';
            pagenation_data += '<td><a href="#createMeating" onclick="fun(\'' + data[i].cname + '\',\'' + data[i].id + '\');" class="popup-form text-body fw-bold">' + data[i].com_id + '</a> </td>';
            pagenation_data += '<td>' + formattedDate + '</td>';
            pagenation_data += '<td href="#createMeating" class="open-popup">' + data[i].cname + '</td>';
            pagenation_data += '<td>' + data[i].name + '</td>';
            let existingprice = parseFloat(data[i].price) - 999;
            let updateprice = existingprice - 4009;

            pagenation_data += '<td>' + data[i].price + '</td>';
            pagenation_data += '<td>' + data[i].amount + '</td>';
            pagenation_data += '<td>' + data[i].dollar_rate + '</td>';
            pagenation_data += '<td>' + data[i].extra_discount + '</td>';
            pagenation_data += '<td>' + data[i].extra_pkr_discount + '</td>';
            pagenation_data += '<td>$' + updateprice.toFixed(2) + '</td>';

            console.log("Updated Price:", updateprice.toFixed(2));




            pagenation_data += '<td>' + data[i].package + '</td>';
            pagenation_data += '<td><span class="badge badge-pill ' + color + ' font-size-11">' + renwal + '</span></td>';
            pagenation_data += '<td>' + data[i].expire_date + '</td>';
            pagenation_data += '<td>' + droupout + '</td>';
            pagenation_data += '<td>' + data[i].status + '</td>';
            pagenation_data += '<td><div class="d-flex gap-1">';
            pagenation_data += '<a href="javascript:void(0)" onclick="paymentpay(\'' + data[i].cname + '\',\'' + data[i].vfy_gm_com_id + '\',\'' + data[i].gmId + '\',\'' + data[i].member_id + '\',\'' + data[i].order_id + '\',\'' + price + '\',\'' + amount + '\',\'' + data[i].gmuId + '\',\'' + data[i].dollar_rate + '\')" data-bs-toggle="modal" data-bs-target=".orderdetailsModal2"><button type="button" style="height:1.5rem; width:1.5rem;" class="btn btn-primary position-relative p-0 avatar-xs rounded-circle" title="Pay To Ab">';
            pagenation_data +=
                '<span class="avatar-title bg-transparent text-reset"><i class="bx bxs-dollar-circle"></i></span></button></a>';
            pagenation_data += '</tr>';
            itemsContainer.append(pagenation_data);

            $("#NC_loan").text(NC);
            $("#RC_loan").text(RC);
            $("#EC_loan").text(EC);
        }
        $("#TotalFullNum_loan").text(datas.totalRecords);

    }

    function displayPagination_loan(totalPages, currentPage) {
        $('#pageNumbers_loan').empty();

        var startPage = Math.max(currentPage - 2, 1);
        var endPage = Math.min(currentPage + 1, totalPages);

        if (startPage > 1) {

            $('#pageNumbers_loan').append('<li class="page-item"><a href="javascript:void(0);" class="page-link" data-page="1">1</a></li>');
            if (startPage > 3) {
                $('#pageNumbers_loan').append('<span class="ellipsis">...</span>');
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            var activeClass = (i === currentPage) ? 'active' : '';
            $('#pageNumbers_loan').append('<li class="page-item ' + activeClass + '"><a href="javascript:void(0);" class="page-link ' + activeClass + '" data-page="' + i + '">' + i + '</a></li>');
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                $('#pageNumbers_loan').append('<span class="ellipsis">...</span>');
            }
            $('#pageNumbers_loan').append('<li class="page-item"><a href="javascript:void(0);" class="page-link"  data-page="' + totalPages + '">' + totalPages + '</a></li>');
        }

        $('#pageNumbers_loan').data('total-pages', totalPages);
    }



    // end dollar gm
    function payDollarsDetail_temp(cname, com_id, gmId, member_id, order_id, dollars, dollar_rate, payid, profit_text, profit_value) {
        $("#order_cname").text(cname);
        $("#order_mid").text(member_id);
        $("#order_oid").text(order_id);
        $("#order_dollar").text(dollars);
        $("#order_dollar_rate").text(dollar_rate);
        $("#order_text").text(profit_text + ':');
        $("#order_text_value").text(profit_value);
        BuyerAllDetails_temp(payid);

        $("#showConfirmBtn").html('<a href="javascript:void(0)" onclick="DoneTempPayToAlibaba(' + payid + ')" class="btn btn-info btn-sm btn-rounded w-75" >Payment Done</a>');
        $("#AddMoreShorForTemp").html('<a href="javascript:void(0)" data-bs-toggle="modal" data-bs-target=".orderdetailsModal2" onclick="paymentpay_temp(\'' + cname + '\',\'' + com_id + '\',\'' + gmId + '\',\'' + member_id + '\',\'' + order_id + '\',\'' + dollars + '\',0,0,\'' + dollar_rate + '\',\'' + payid + '\')" class="btn btn-warning btn-sm btn-rounded w-75 mb-2" >Add More Short</a>');



    }

    function BuyerAllDetails_temp(payid) {
        $.ajax({
            url: 'layouts/func.php',
            type: 'GET',
            data: {
                payId_buyerDetail_temp: payid
            },
            dataType: 'json',
            success: function(data) {
                displayData_temp(data);
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }

    function displayData_temp(datas) {
        $('#buyerDetails').empty();
        var num = 0;
        var itemsContainer = $('#buyerDetails');
        var data = JSON.parse(datas.buyer_detail);

        var profit_loss = '';

        for (var i = 0; i < data.length; i++) {

            num++;

            let pagenation_data = '<tr><th scope="row">';
            pagenation_data += '<div>' + num + '</div></th>';
            pagenation_data += '<td><div><h5 class="text-truncate font-size-14">' + data[i].buyer_main_name + '</h5>';
            pagenation_data += '<p class="text-muted mb-0">' + data[i].buyer_paypal_email + '</p>';
            pagenation_data += '<p class="text-muted mb-0">Total: <span class="text-primary">$ ' + data[i].dollarTotal + '</span>   Rate:<span class="text-primary"> ' + data[i].buyer_dollar_rate + '</span></p></td>';
            pagenation_data += '</div></td>';
            pagenation_data += '<td>$ ' + data[i].dollarUse + '</td>';
            pagenation_data += '<td>$ ' + (data[i].dollarTotal - data[i].dollarUse) + '  <label for="selectcheckBoxNotShow' + data[i].buyer_dollar_short_id + '" class="font-size-12"><input class="form-check-input" type="checkbox" name="selectcheckBoxNotShow' + data[i].buyer_dollar_short_id + '" id="selectcheckBoxNotShow' + data[i].buyer_dollar_short_id + '" value="Not Used"> Not Used   </label> <a href="javascript:void(0);" onclick="RemoveShortTempDetail(' + data[i].buyer_dollar_short_id + ',' + datas.id + ',' + data[i].dollarUse + ')" data-bs-toggle="modal" class="text-danger btn btn-sm btn-soft-danger"><i class="bx bxs-x-circle font-size-20"></i></a></td></tr>';
            itemsContainer.append(pagenation_data);

        }
    }

    function RemoveShortTempDetail(TemDetailShort, id, dollarUse) {
        var isChecked = $('#selectcheckBoxNotShow' + TemDetailShort).is(':checked');

        if (isChecked) {
            var selectcheckBoxNotShow = $('#selectcheckBoxNotShow' + TemDetailShort).val();
            console.log('Checkbox is checked. Value:', selectcheckBoxNotShow);
        } else {
            console.log('Checkbox is not checked');
        }


        $.ajax({
            url: 'layouts/func.php',
            type: 'POST',
            data: {
                RemoveShortTempDetail: TemDetailShort,
                temp_row_id: id,
                dollarUse: dollarUse,
                selectcheckBoxNotShow: selectcheckBoxNotShow
            },
            dataType: 'json',
            success: function(data) {
                // displayData_temp(id);
                BuyerAllDetails_temp(id);
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }

    function DoneTempPayToAlibaba(TemPayIdToConfirmPay) {

        $.ajax({
            url: 'layouts/func.php',
            type: 'POST',
            data: {
                TemPayIdToConfirmPay: TemPayIdToConfirmPay
            },
            dataType: 'json',
            success: function(data) {
                swal("Poof! You successfully pay!", {
                    icon: "success",
                });
                loadPage(1);
                loadPage2(1);
                $("#closeBtn").click();
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }

    function GenrateEmailTem() {
        var TodayGenrateEmail = 'TodayGenrateEmail';
        $.ajax({
            url: 'layouts/emails/AlibabaTemPayment.php',
            type: 'POST',
            data: {
                TodayGenrateEmail: TodayGenrateEmail
            },
            success: function(data) {
                if (data.trim()) {
                    notification_Success('Email send successfully');
                } else {
                    notification_error('Email not send');
                }

            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
            }
        });
    }
</script>
<script>
    // Helper functions for data attribute approach
    function funWithDataAttr(element) {
        var cname = element.getAttribute('data-cname');
        var id = element.getAttribute('data-id');
        fun(cname, id);
    }

    function paymentPayWithDataAttr(element) {
        var cname = element.getAttribute('data-cname');
        var vfyGmComId = element.getAttribute('data-vfy-gm-com-id');
        var gmId = element.getAttribute('data-gm-id');
        var memberId = element.getAttribute('data-member-id');
        var orderId = element.getAttribute('data-order-id');
        var price = element.getAttribute('data-price');
        var amount = element.getAttribute('data-amount');
        var gmuId = element.getAttribute('data-gmu-id');
        var dollarRate = element.getAttribute('data-dollar-rate');

        paymentpay(cname, vfyGmComId, gmId, memberId, orderId, price, amount, gmuId, dollarRate);
    }

    function paymentPayTempWithDataAttr(element) {
        var cname = element.getAttribute('data-cname');
        var vfyGmComId = element.getAttribute('data-vfy-gm-com-id');
        var gmId = element.getAttribute('data-gm-id');
        var memberId = element.getAttribute('data-member-id');
        var orderId = element.getAttribute('data-order-id');
        var price = element.getAttribute('data-price');
        var amount = element.getAttribute('data-amount');
        var gmuId = element.getAttribute('data-gmu-id');
        var dollarRate = element.getAttribute('data-dollar-rate');

        paymentpay_temp(cname, vfyGmComId, gmId, memberId, orderId, price, amount, gmuId, dollarRate);
    }
</script>
<script>
    let currentTableData = [];
    let currentTableTotals = {};
    let allTableData = []; // Store ALL data for export (not just current page)

    function exportToExcel() {
        try {
            const exportBtn = document.querySelector('button[onclick="exportToExcel()"]');
            const originalText = exportBtn.innerHTML;
            exportBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin me-1"></i>Loading...';
            exportBtn.disabled = true;

            const searchValue = document.getElementById('searchInput2') ? document.getElementById('searchInput2').value || '' : '';
            const fromDate2 = document.getElementById('fromDate2') ? document.getElementById('fromDate2').value || '' : '';
            const toDate2 = document.getElementById('toDate2') ? document.getElementById('toDate2').value || '' : '';

            $.ajax({
                url: 'layouts/func.php',
                type: 'POST',
                data: {
                    export_all_data: true,
                    search: searchValue,
                    fromDate2: fromDate2,
                    toDate2: toDate2
                },
                dataType: 'json',
                success: function(allData) {
                    exportBtn.innerHTML = originalText;
                    exportBtn.disabled = false;

                    if (allData.records && allData.records.length > 0) {
                        setAllDataForExport(allData.records);
                        performActualExport();
                    } else {
                        alert('No data available to export!');
                    }
                },
                error: function(xhr, status, error) {
                    exportBtn.innerHTML = originalText;
                    exportBtn.disabled = false;

                    console.error('Export error:', error);
                    console.error('Status:', status);
                    console.error('Response:', xhr.responseText);
                    alert('Error occurred while fetching data for export. Please try again.');
                }
            });

        } catch (error) {
            console.error('Export error:', error);
            alert('Error occurred while exporting to Excel. Please try again.');
        }
    }

    function setAllDataForExport(data) {
        allTableData = data;
    }

    function performActualExport() {
        try {
            let dataToExport = [];

            if (allTableData && allTableData.length > 0) {
                dataToExport = allTableData;
                console.log('Exporting all data:', dataToExport.length, 'records');
            } else {
                alert('No data available to export!');
                return;
            }

            const wb = XLSX.utils.book_new();

            const excelData = [];

            const headers = [
                'S.No', 'Ab Date', 'Bv Date', 'Drm Id', 'Ab Id', 'Order Id', 'Company', 'Person',
                'T-Dollar', 'PKR', 'TD Rate', 'Package', 'Type', 'Ex-Disc', 'Ex-Disc Pkr',
                'Pay Status', 'Report', 'Cus $ Rate', 'Cus $ Profit'
            ];
            excelData.push(headers);

            let totalDollarsPay = 0;
            let totalCurrentDollarsPayProfit = 0;
            let totalCurrentDollarsPayLoss = 0;
            let totalcus_profitPayProfit = 0;
            let totalcus_profitPayLoss = 0;
            let total_extra_disc = 0;
            let total_extra_disc_pkr = 0;
            let total_pkr = 0;

            for (let i = 0; i < dataToExport.length; i++) {
                const record = dataToExport[i];

                let currentDate = new Date(record.pay_date);
                var day = currentDate.getDate();
                var month = currentDate.getMonth() + 1;
                var year = currentDate.getFullYear();
                var formattedDate = year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;

                var customer_dollar_rate = record.customer_dollar_rate;
                var customer_dollars = record.price;
                var pay_dollar_rate = record.dollar_rate;
                var pay_dollars = record.dollars;
                var customer_pkr = customer_dollars * customer_dollar_rate;
                var pay_pkr = pay_dollars * pay_dollar_rate;
                var pkr_difference = customer_pkr - pay_pkr;

                var profit_loss = (customer_pkr - pay_pkr) / pay_dollar_rate;
                var profit = '';

                if (pkr_difference > 0) {
                    profit = 'Profit';
                    totalCurrentDollarsPayProfit += profit_loss;
                } else if (pkr_difference < 0) {
                    profit = 'Loss';
                    totalCurrentDollarsPayLoss += profit_loss;
                } else {
                    profit = 'Equal';
                }

                totalDollarsPay += parseInt(record.dollars);

                var cust_dollar_pay = parseFloat(record.cus_profit);
                if (cust_dollar_pay > 0) {
                    totalcus_profitPayProfit += cust_dollar_pay;
                } else if (cust_dollar_pay < 0) {
                    totalcus_profitPayLoss += cust_dollar_pay;
                }

                var extra_discount = 0;
                if (!isNaN(record.extra_discount) && isFinite(record.extra_discount) && record.extra_discount !== '' && record.extra_discount !== null) {
                    extra_discount = parseFloat(record.extra_discount);
                }
                total_extra_disc += extra_discount;

                var extra_pkr_discount = 0;
                if (!isNaN(record.extra_pkr_discount) && isFinite(record.extra_pkr_discount) && record.extra_pkr_discount !== '' && record.extra_pkr_discount !== null) {
                    extra_pkr_discount = parseFloat(record.extra_pkr_discount);
                }
                total_extra_disc_pkr += extra_pkr_discount;

                var current_pkr_amount = 0;
                if (!isNaN(record.pkr_amount) && isFinite(record.pkr_amount) && record.pkr_amount !== '' && record.pkr_amount !== null) {
                    current_pkr_amount = parseFloat(record.pkr_amount);
                }
                total_pkr += current_pkr_amount;

                const rowData = [
                    i + 1, // Serial number
                    formattedDate,
                    record.bv_date || '',
                    record.com_id || '',
                    record.member_id || '',
                    record.order_id || '',
                    record.cname || '',
                    record.name || '',
                    '$ ' + record.dollars,
                    current_pkr_amount.toFixed(2),
                    record.dollar_rate || '',
                    record.package || '',
                    record.type || '',
                    extra_discount.toFixed(2),
                    extra_pkr_discount.toFixed(2),
                    record.pay_status || '',
                    profit + ': $ ' + profit_loss.toFixed(2),
                    record.cus_dollar_rate || '',
                    record.cus_profit || ''
                ];

                excelData.push(rowData);
            }

            excelData.push(['']);

            // Add totals row
            const totalsRow = [
                '', '', '', '', '', '', 'TOTALS:', // Empty cells until T-Dollar column
                '$ ' + totalDollarsPay.toFixed(2), // Total Dollars
                total_pkr.toFixed(2), // Total PKR
                '', '', '', // Empty cells
                total_extra_disc.toFixed(2), // Extra Discount
                total_extra_disc_pkr.toFixed(2), // Extra PKR Discount
                '', // Pay Status
                'Profit: $ ' + totalCurrentDollarsPayProfit.toFixed(2), // Profit
                '', // Cus $ Rate
                'Cus Profit: $ ' + totalcus_profitPayProfit.toFixed(2) // Customer Profit
            ];
            excelData.push(totalsRow);

            const cusLossRow = [
                '', '', '', '', '', '', 'Customer Loss:',
                '', '', '', '', '', '', '', '',
                'Loss: $ ' + Math.abs(totalCurrentDollarsPayLoss).toFixed(2),
                '',
                'Cus Loss: $ ' + Math.abs(totalcus_profitPayLoss).toFixed(2)
            ];
            excelData.push(cusLossRow);

            const ws = XLSX.utils.aoa_to_sheet(excelData);

            ws['!cols'] = [{
                    wch: 8
                }, // S.No
                {
                    wch: 12
                }, // abDate
                {
                    wch: 12
                }, // bvdate
                {
                    wch: 10
                }, // Drm Id
                {
                    wch: 10
                }, // Ab Id
                {
                    wch: 12
                }, // Order Id
                {
                    wch: 15
                }, // Company
                {
                    wch: 15
                }, // Person
                {
                    wch: 12
                }, // T-Dollar
                {
                    wch: 10
                }, // TD Rate
                {
                    wch: 12
                }, // Package
                {
                    wch: 10
                }, // Type
                {
                    wch: 10
                }, // Ex-Disc
                {
                    wch: 12
                }, // Pay Status
                {
                    wch: 18
                }, // Report
                {
                    wch: 12
                }, // Cus $ Rate
                {
                    wch: 12
                } // Cus $ Profit
            ];

            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({
                    r: 0,
                    c: C
                });
                if (!ws[cellAddress]) continue;
                ws[cellAddress].s = {
                    font: {
                        bold: true
                    },
                    fill: {
                        fgColor: {
                            rgb: "CCCCCC"
                        }
                    },
                    alignment: {
                        horizontal: "center"
                    }
                };
            }

            XLSX.utils.book_append_sheet(wb, ws, 'Alibaba Payments');

            const currentDate = new Date();
            const dateString = currentDate.toISOString().split('T')[0];
            const timeString = currentDate.toTimeString().split(' ')[0].replace(/:/g, '-');
            const filename = `Alibaba_Payments_All_Data_${dateString}_${timeString}.xlsx`;

            XLSX.writeFile(wb, filename);

            alert(`Excel file has been downloaded successfully!\nTotal records exported: ${dataToExport.length}`);

        } catch (error) {
            console.error('Export error:', error);
            alert('Error occurred while exporting to Excel. Please try again.');
        }
    }

    $(document).ready(function() {
        document.getElementById("modal_bvdate").addEventListener("change", function() {
            updateStartEndDate(this.value);
        });
    });
</script>
<script>
    $(document).ready(function() {
        $('#filterPartialDate').click(function() {
            let fromDate = $('#partialFromDate').val();
            let toDate = $('#partialToDate').val();

            let url = new URL(window.location.href);
            url.searchParams.set('partial_from_date', fromDate);
            url.searchParams.set('partial_to_date', toDate);
            url.searchParams.set('tab', 'partial_payment_tab');

            window.location.href = url.toString();
        });

        $('#clearPartialDate').click(function() {
            let url = new URL(window.location.href);
            url.searchParams.delete('partial_from_date');
            url.searchParams.delete('partial_to_date');
            url.searchParams.set('tab', 'partial_payment_tab');

            window.location.href = url.toString();
        });

        const urlParams = new URLSearchParams(window.location.search);
        const activeTab = urlParams.get('tab');
        if (activeTab) {
            $('.tab-pane').removeClass('active show');
            $('.nav-link').removeClass('active');

            $('#' + activeTab).addClass('active show');
            $('[href="#' + activeTab + '"]').addClass('active');
        }
    });
</script>