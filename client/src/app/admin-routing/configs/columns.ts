export const columns = [
  { field: `change_number`, name: `Change`, exportColumnWidth: 10 },
  { field: `status`, name: `Status`, exportColumnWidth: 8 },
  { field: `vehicle_line`, name: `Vehicle line`, exportColumnWidth: 14 },
  { field: `build_event`, name: `Build event`, exportColumnWidth: 15 },
  { field: `commodity_group`, name: `Commodity group`, exportColumnWidth: 35 },
  {
    field: `landed_at`,
    name: `Landed at`,
    exportField: `landed_at_date`,
    exportColumnWidth: 18,
    exportNumberFormat: `dd/mm/yyyy hh:mm:ss`,
  },
  { field: `assignee`, name: `Assignee`, exportColumnWidth: 11 },
  { field: `part_count`, name: `Part count`, exportColumnWidth: 12 },
  { field: `team`, name: `Team`, exportColumnWidth: 15 },
  { field: `newAssignee`, name: `New assignee`, exportColumnWidth: 15 },
];
