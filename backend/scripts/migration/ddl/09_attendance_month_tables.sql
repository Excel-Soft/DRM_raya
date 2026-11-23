-- drm.attendance_month + attendance_month_history (staging / import parity)
CREATE TABLE IF NOT EXISTS drm.attendance_month (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES drm.users(id) ON DELETE CASCADE,
  late_hour integer NOT NULL DEFAULT 0,
  late_min integer NOT NULL DEFAULT 0,
  half_leave integer NOT NULL DEFAULT 0,
  leaves integer NOT NULL DEFAULT 0,
  branch text,
  month integer NOT NULL,
  year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, year)
);

CREATE TABLE IF NOT EXISTS drm.attendance_month_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES drm.users(id) ON DELETE CASCADE,
  late_hour integer NOT NULL DEFAULT 0,
  late_min integer NOT NULL DEFAULT 0,
  half_leave integer NOT NULL DEFAULT 0,
  leaves integer NOT NULL DEFAULT 0,
  month integer NOT NULL,
  year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, year)
);
