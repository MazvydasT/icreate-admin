WITH
  change_service_data AS (
    SELECT * FROM EXTERNAL_QUERY(
      "jlr-ddc1-prod.europe-west1.ods_icreate_change_service_sql_connection",
      """
      SELECT DISTINCT
        engineering_changes.business_change_id,
        CAST(SUBSTRING_INDEX(engineering_changes.business_change_id, '-', 1) AS SIGNED) change_number,
        engineering_changes.status,

        COUNT(
          IFNULL(change_parts.prefix, change_parts.old_prefix) || '-' ||
          IFNULL(change_parts.base, change_parts.old_base) || '-' ||
          IFNULL(change_parts.suffix, change_parts.old_suffix)
        ) part_count,

        change_lead_programmes.vehicle_line,
        change_lead_programmes.build_event

      FROM engineering_changes

      INNER JOIN (
        SELECT MAX(id) id FROM engineering_changes
        GROUP BY business_change_id
      ) max_id USING(id)

      LEFT JOIN change_parts ON engineering_changes.id = change_parts.engineering_change_id
      LEFT JOIN change_lead_programmes ON engineering_changes.change_lead_programme_id = change_lead_programmes.id

      WHERE
        status IN ('Initiate', 'Compile', 'Revise') AND
        TRIM(LOWER(initiator)) NOT LIKE 'leadeng%' AND
        TRIM(UPPER(change_lead_programmes.programme)) NOT LIKE 'EB%'
      
      GROUP BY
        engineering_changes.business_change_id,
        engineering_changes.status,
        change_lead_programmes.vehicle_line,
        change_lead_programmes.build_event
      """
    )
  ),

  workflow_poc_data AS (
    SELECT * FROM EXTERNAL_QUERY(
      "jlr-ddc1-prod.europe-west1.ods_icreate_workflow_sql_connection",
      """
      SELECT DISTINCT
        ACT_HI_PROCINST.BUSINESS_KEY_ business_change_id,
        IF(
          has_open_non_admin_tasks,
          NULL,
          COALESCE(
            non_admin_task_end_time,
            task_data.START_TIME_
          )
        ) landed_at,

        LOWER(TRIM(task_data.ASSIGNEE_)) assignee

      FROM ACT_HI_PROCINST

      INNER JOIN (
        SELECT *
        FROM ACT_HI_TASKINST

        LEFT JOIN (
          SELECT
            PROC_INST_ID_,
            MAX(END_TIME_) non_admin_task_end_time,
            SUM(IF(END_TIME_ IS NULL, 1, 0)) > 0 has_open_non_admin_tasks

          FROM ACT_HI_TASKINST

          WHERE LOWER(NAME_) NOT LIKE '%administrator%'

          GROUP BY PROC_INST_ID_
        ) non_admin_task_data USING(PROC_INST_ID_)

        WHERE
          LOWER(ACT_HI_TASKINST.NAME_) LIKE '%administrator%' AND
          ACT_HI_TASKINST.END_TIME_ IS NULL
      ) task_data ON ACT_HI_PROCINST.ID_ = task_data.PROC_INST_ID_
      """
    )
  )

SELECT * EXCEPT(business_change_id)
FROM change_service_data
INNER JOIN workflow_poc_data USING(business_change_id)
WHERE landed_at IS NOT NULL