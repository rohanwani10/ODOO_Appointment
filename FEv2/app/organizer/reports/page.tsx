"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import type {
  AppointmentReportItem,
  BookingReportItem,
  CustomerInsightItem,
  ResourceUtilizationItem,
  RevenueResponse,
} from "@/lib/types";

export default function OrganizerReportsPage() {
  const [appointments, setAppointments] = useState<AppointmentReportItem[]>([]);
  const [resourceUtilization, setResourceUtilization] = useState<ResourceUtilizationItem[]>([]);
  const [bookings, setBookings] = useState<BookingReportItem[]>([]);
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [customerInsights, setCustomerInsights] = useState<CustomerInsightItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadReports() {
    try {
      const [
        appointmentData,
        resourceData,
        bookingData,
        revenueData,
        customerData,
      ] = await Promise.all([
        apiFetch<AppointmentReportItem[]>("/api/reports/appointments"),
        apiFetch<ResourceUtilizationItem[]>("/api/reports/resource-utilization"),
        apiFetch<BookingReportItem[]>("/api/reports/bookings"),
        apiFetch<RevenueResponse>("/api/reports/revenue"),
        apiFetch<CustomerInsightItem[]>("/api/reports/customer-insights"),
      ]);
      setAppointments(appointmentData);
      setResourceUtilization(resourceData);
      setBookings(bookingData);
      setRevenue(revenueData);
      setCustomerInsights(customerData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reports");
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function handleExport() {
    const session = getSession();
    if (!session) {
      setError("Not authenticated.");
      return;
    }

    try {
      const response = await fetch("/api/reports/export", {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "appointments-export.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export");
    }
  }

  return (
    <RequireAuth allowedRoles={["ORGANIZER", "ADMIN"]}>
      <div className="page">
        <section className="panel">
          <h1>Organizer reports</h1>
          {error ? <p className="error">{error}</p> : null}
          <button type="button" onClick={() => void handleExport()}>
            Export appointments CSV
          </button>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Appointments by date</h2>
            <div className="list">
              {appointments.map((item) => (
                <article key={item.date} className="item">
                  <p>{item.date}</p>
                  <p>{item.count} appointments</p>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Estimated revenue</h2>
            <p>{revenue?.revenue ?? 0}</p>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Bookings by service</h2>
            <div className="list">
              {bookings.map((item) => (
                <article key={item.service_id} className="item">
                  <p>{item.service_name}</p>
                  <p>{item.count} bookings</p>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Top customers</h2>
            <div className="list">
              {customerInsights.map((item) => (
                <article key={item.customer_id} className="item">
                  <p>{item.email || item.customer_id}</p>
                  <p>{item.count} bookings</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Resource utilization</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Appointments</th>
                  <th>Minutes booked</th>
                </tr>
              </thead>
              <tbody>
                {resourceUtilization.map((item) => (
                  <tr key={item.resource_id}>
                    <td>{item.resource_name || item.resource_id}</td>
                    <td>{item.total_appointments}</td>
                    <td>{item.total_minutes_booked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}
