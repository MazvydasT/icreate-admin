export const columns = [
  { field: `change_number`, name: `Change` },
  { field: `status`, name: `Status` },
  { field: `vehicle_line`, name: `Vehicle line` },
  { field: `build_event`, name: `Build event` },
  {
    field: `landed_at`,
    name: `Landed at`,
    exportField: `landed_at_date`,
    exportColumnWidth: 11.15,
  },
  { field: `assignee`, name: `Assignee` },
  { field: `part_count`, name: `Part count` },
  { field: `team`, name: `Team`, exportColumnWidth: 15 },
  { field: `newAssignee`, name: `New assignee` },
];
