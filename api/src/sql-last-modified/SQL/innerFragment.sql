  SELECT * FROM EXTERNAL_QUERY(
  "@connectionId",
  """
  SELECT UPDATE_TIME
  FROM information_schema.tables
  WHERE TABLE_NAME IN (@tableNames)
  """
  )