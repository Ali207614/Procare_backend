# CRM Analytics API Response Design

## Endpoint

```http
GET /api/v1/analytics/call-center/leads-by-employee
```

---

# Purpose

This endpoint is designed for rendering analytics tables like:

* Employees / Call centers
* Total leads
* Dynamic statuses
* Counts
* Percentages
* Summary rows

The schema is designed to be:

* Dynamic
* Frontend-friendly
* Scalable
* Cacheable
* Database-efficient
* Safe for UUID-based statuses

---

# Core Principles

## 1. Statuses are dynamic

Statuses must NOT be hardcoded like:

```json
"new_lead"
```

because statuses may:

* change
* be deleted
* be renamed
* be reordered
* differ between CRM installations

Instead:

* use UUID as the stable machine identifier
* use separate metadata for rendering

---

## 2. UUID is the source of truth

Always use:

```json
"statusId": "uuid"
```

instead of status names.

Status names are only UI labels.

---

## 3. Percentages should be numeric

Correct:

```json
"percent": 12.32
```

Wrong:

```json
"percent": "12,32%"
```

Frontend should format percentages itself.

---

# Recommended Response Schema

```ts
type AnalyticsResponse = {
  meta: AnalyticsMeta;

  summary: AnalyticsSummary;

  statuses: AnalyticsStatus[];

  rows: EmployeeAnalyticsRow[];
};
```

---

# Meta Section

Contains analytics configuration and metadata.

```ts
type AnalyticsMeta = {
  period: {
    from: string;
    to: string;
  };

  generatedAt: string;

  groupBy: "employee";

  percentageBase: "total_leads" | "employee_leads";
};
```

---

# Summary Section

Represents the top "Jami ulush" row.

```ts
type AnalyticsSummary = {
  totalLeads: number;

  statuses: Record<string, SummaryStatusMetric>;
};
```

---

## Summary Status Metric

```ts
type SummaryStatusMetric = {
  statusId: string;

  count: number;

  percentOfTotalLeads: number;
};
```

---

# Statuses Section

Contains metadata for dynamic table columns.

```ts
type AnalyticsStatus = {
  id: string;

  name: string;

  color?: string;

  order: number;

  isActive?: boolean;
};
```

---

# Rows Section

Contains employee analytics rows.

```ts
type EmployeeAnalyticsRow = {
  index: number;

  employee: {
    id: string;
    fullName: string;
  };

  leads: {
    count: number;
    percentOfTotal: number;
  };

  statusMetrics: Record<string, EmployeeStatusMetric>;
};
```

---

# Employee Status Metric

```ts
type EmployeeStatusMetric = {
  statusId: string;

  count: number;

  percentOfEmployeeLeads: number;

  percentOfTotalLeads?: number;
};
```

---

# Full Example Response

```json
{
  "meta": {
    "period": {
      "from": "2026-05-01",
      "to": "2026-05-13"
    },
    "generatedAt": "2026-05-13T12:00:00.000Z",
    "groupBy": "employee",
    "percentageBase": "employee_leads"
  },

  "summary": {
    "totalLeads": 2841,

    "statuses": {
      "7d6f9a2e-8e10-4a2e-96a0-8b4f1a7c1111": {
        "statusId": "7d6f9a2e-8e10-4a2e-96a0-8b4f1a7c1111",
        "count": 198,
        "percentOfTotalLeads": 6.97
      },

      "18d9e40c-2c7f-4e4d-a6d6-62efc76f2222": {
        "statusId": "18d9e40c-2c7f-4e4d-a6d6-62efc76f2222",
        "count": 66,
        "percentOfTotalLeads": 2.32
      }
    }
  },

  "statuses": [
    {
      "id": "7d6f9a2e-8e10-4a2e-96a0-8b4f1a7c1111",
      "name": "Qayta aloqa",
      "color": "#DBEAFE",
      "order": 1,
      "isActive": true
    },

    {
      "id": "18d9e40c-2c7f-4e4d-a6d6-62efc76f2222",
      "name": "Javob bermadi",
      "color": "#FED7AA",
      "order": 2,
      "isActive": true
    }
  ],

  "rows": [
    {
      "index": 1,

      "employee": {
        "id": "emp_001",
        "fullName": "Абдусаттарова Ситора"
      },

      "leads": {
        "count": 350,
        "percentOfTotal": 12.32
      },

      "statusMetrics": {
        "7d6f9a2e-8e10-4a2e-96a0-8b4f1a7c1111": {
          "statusId": "7d6f9a2e-8e10-4a2e-96a0-8b4f1a7c1111",
          "count": 40,
          "percentOfEmployeeLeads": 11.43
        },

        "18d9e40c-2c7f-4e4d-a6d6-62efc76f2222": {
          "statusId": "18d9e40c-2c7f-4e4d-a6d6-62efc76f2222",
          "count": 11,
          "percentOfEmployeeLeads": 3.14
        }
      }
    }
  ]
}
```

---

# Frontend Rendering Logic

Frontend should render dynamic columns using:

```ts
response.statuses
```

Example:

```ts
for (const status of response.statuses) {
  const metric = row.statusMetrics[status.id];

  const count = metric?.count ?? 0;
  const percent = metric?.percentOfEmployeeLeads ?? 0;
}
```

---

# Why This Architecture Is Professional

## Dynamic

No hardcoded statuses.

---

## Stable

UUIDs never break when names change.

---

## Backend-safe

Works with:

* SQL
* MongoDB
* Elasticsearch
* Redis cache

---

## Frontend-friendly

Frontend can build tables dynamically.

---

## Extensible

You can later add:

* funnels
* charts
* grouped analytics
* departments
* branch filtering
* time comparisons
* heatmaps
* SLA metrics

without changing the core structure.

---

# Recommended Query Parameters

```http
GET /api/v1/analytics/call-center/leads-by-employee
```

Example:

```http
/api/v1/analytics/call-center/leads-by-employee
  ?from=2026-05-01
  &to=2026-05-13
  &branchId=uuid
  &employeeIds=uuid1,uuid2
  &statusIds=uuid1,uuid2
```

---

# Recommended Backend Strategy

Best production strategy:

1. Aggregate grouped lead counts in SQL
2. Fetch statuses separately
3. Build sparse status maps
4. Return zeros only on frontend

This keeps payloads smaller and faster.

---

# Final Recommendation

The best professional architecture is:

* Separate dynamic status metadata
* UUID-based metrics
* Sparse row metrics
* Numeric percentages
* Fully dynamic rendering

This is the same architectural direction used in enterprise CRM analytics systems.
