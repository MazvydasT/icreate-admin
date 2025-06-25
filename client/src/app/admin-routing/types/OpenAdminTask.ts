export type OpenAdminTask = {
  change_number: number;
  status: string;
  part_count: number;
  vehicle_line?: string;
  build_event: string;
  landed_at: {
    value: string;
  };
  assignee: string;
  commodity_group?: string;
};
