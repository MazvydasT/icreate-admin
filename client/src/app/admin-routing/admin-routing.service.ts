import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { OpenAdminTask } from './types/OpenAdminTask';

@Injectable({
  providedIn: 'root',
})
export class AdminRoutingService {
  private readonly httpClient = inject(HttpClient);

  getOpenAdminTasks() {
    //if (isDevMode()) return of(OPEN_ADMIN_TASKS_MOCK_DATA);

    return this.httpClient.get<OpenAdminTask[]>(
      `/api/adminRouting/openAdminTasks`
    );
  }

  getVehicleLines() {
    return this.httpClient.get<string[]>(`/api/adminRouting/vehicleLines`);
  }
}
