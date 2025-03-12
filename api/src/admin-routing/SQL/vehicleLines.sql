SELECT * FROM EXTERNAL_QUERY(
  "jlr-ddc1-prod.europe-west1.ods_icreate_change_service_sql_connection",
  """
  SELECT DISTINCT TRIM(vehicle_line) vehicle_line

  FROM change_lead_programmes

  WHERE
    TRIM(UPPER(vehicle_line)) NOT LIKE 'EBA%' AND
    NULLIF(TRIM(vehicle_line), '') IS NOT NULL
  """
)
ORDER BY vehicle_line