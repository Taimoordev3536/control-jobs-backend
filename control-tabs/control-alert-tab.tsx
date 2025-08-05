// "use client"

// import TabTableTemplate, { type TabTableColumn } from "@/components/ui/tab-table-template"
// import { useTranslation } from "@/hooks/use-translation"

// export default function ControlAlertTab() {
//   const { t } = useTranslation()

//   const columns: TabTableColumn[] = [
//     { key: "holder", label: t("client"), sortable: true },
//     { key: "job", label: t("job"), sortable: true },
//     { key: "workCenter", label: t("workCenter"), sortable: true },
//     { key: "worker", label: t("worker"), sortable: true },
//     { key: "notification", label: t("notification"), sortable: false, align: "center" },
//   ]

//   // Sample data - replace with actual data from API
//   const data: any[] = []

//   return <TabTableTemplate columns={columns} data={data} emptyMessage={t("noAlertDataAvailable")} />
// }
