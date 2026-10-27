<?php
$created_by = 1;

if (isset($_COOKIE['id']) && !empty($_COOKIE['id'])) {
    $created_by = intval($_COOKIE['id']);
} elseif (isset($_SESSION['user_id']) && !empty($_SESSION['user_id'])) {
    $created_by = intval($_SESSION['user_id']);
}

?>

<div class="main-content">

    <div class="page-content">
        <div class="container-fluid">

            <div class="row">
                <div class="col-12">
                    <div class="page-title-box d-sm-flex align-items-center justify-content-between">

                        <h4 class="mb-sm-0 font-size-18">VAS System</h4>

                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-xl-12">
                    <div class="card">
                        <div class="card-body">

                            <form id="view_user_vas" action="">

                                <div class="row">

                                    <div class="col-md-4">
                                        <div class="mb-3 position-relative">
                                            <label for="validationCustom03" class="form-label">Select User</label>
                                            &nbsp;&nbsp;&nbsp;
                                            <input class="form-check-input text-end" type="checkbox" name="user_id_vas_view_month_waise" value="month_waise" id="user_id_vas_view_month_waise" style="float:none !important;">
                                            &nbsp;
                                            <label class="form-check-label" for="user_id_vas_view_month_waise">Month Wise</label>

                                            <?php
                                            // Allow dropdown if:
                                            // 1. role_id in [14, 32, 48] (old condition), OR
                                            // 2. created_by == 54427, OR
                                            // 3. role_id == 27
                                            if (in_array($role_id, [14, 32, 48]) || $created_by == 54427 || $role_id == 27) {
                                            ?>
                                                <select class="form-select select2" id="user_id_vas_view" name="user_id_vas_view" required>
                                                    <option selected="" disabled="" value="">Choose...</option>
                                                    <option value="All">All</option>
                                                    <?php
                                                    $qury = "SELECT * FROM webxl_role";
                                                    $run = mysqli_query($con, $qury);
                                                    while ($row = mysqli_fetch_assoc($run)) {
                                                        $rule_id = $row['id'];
                                                        echo '<optgroup label="' . $row['name'] . '">';

                                                        $qury1 = "SELECT * FROM webxl_user";
                                                        $run1 = mysqli_query($con, $qury1);
                                                        while ($row1 = mysqli_fetch_assoc($run1)) {
                                                            $value1 = $row1['roleId'];
                                                            $va = explode(",", $value1);
                                                            if (in_array($rule_id, $va)) {
                                                                echo '<option value="' . $row1['user_id'] . '">' . $row1['name'] . '</option>';
                                                            }
                                                        }
                                                        echo '</optgroup>';
                                                    }
                                                    ?>
                                                </select>
                                            <?php
                                            } else {
                                            ?>
                                                <input type="hidden" id="user_id_vas_view" name="user_id_vas_view" value="<?= $user_id ?>">
                                                <input type="text" class="form-control" value="<?= username($user_id) ?>" readonly>
                                            <?php } ?>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="formrow-password-input" class="form-label">Start Date</label>
                                            <div class="input-group" id="datepicker1">
                                                <input type="text" class="form-control" placeholder="yyyy-m-d"
                                                    data-date-format="yyyy-m-d" data-date-container="#datepicker1"
                                                    data-provide="datepicker" name="startData" autocomplete="off" required>

                                                <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>

                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="formrow-password-input" class="form-label">End Date</label>
                                            <div class="input-group" id="datepicker2">
                                                <input type="text" class="form-control" placeholder="yyyy-m-d"
                                                    data-date-format="yyyy-m-d" data-date-container="#datepicker2"
                                                    data-provide="datepicker" name="endData" autocomplete="off" required>

                                                <span class="input-group-text"><i class="mdi mdi-calendar"></i></span>

                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <button type="submit" class="btn btn-primary w-md">View</button>
                                    </div>
                                </div>

                            </form>
                        </div>
                        <!-- end card body -->
                    </div>
                    <!-- end card -->
                </div>
                <div class="tab-pane" id="messages-1" role="tabpanel">
                    <div class="col-xl-12">
                        <div class="card">
                            <div class="card-body">
                                <h4 class="card-title mb-4">VAS View</h4>
                                <div class="table-responsive1" id="attendence_List">
                                    <table class="table table-striped mb-0 text-center">

                                        <thead>
                                            <tr class="table-success">

                                                <th>Company</th>
                                                <th>Amount</th>
                                                <th>Method</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <th scope="row">trusmile surgical</th>
                                                <td>10000</td>
                                                <td>364</td>
                                                <td>2021-07-13 17:08:25</td>
                                            </tr>
                                            <tr>
                                                <th scope="row">trusmile surgical</th>
                                                <td>10000</td>
                                                <td>364</td>
                                                <td>2021-07-13 17:08:25</td>
                                            </tr>

                                        </tbody>
                                    </table>
                                </div>

                            </div>
                        </div>

                    </div>
                </div>
            </div>
            <!-- end col -->
        </div> <!-- end row -->

    </div>

</div>
<script type="text/javascript">
    $(document).ready(function() {
        $("#view_user_vas").on("submit", function(e) {
            e.preventDefault();

            var formData = new FormData(this);

            $.ajax({
                type: "POST",
                url: "layouts/Controller/VasController.php",
                data: formData,
                contentType: false,
                processData: false,
                success: function(data) {
                    $('#attendence_List').fadeIn();
                    $('#attendence_List').html(data);
                },
                error: function(xhr, status, error) {
                    console.log(xhr.responseText);
                    $('#attendence_List').html('<div class="alert alert-danger">Something went wrong.</div>');
                }
            });
        });
    });
</script>