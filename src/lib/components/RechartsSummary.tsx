import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

interface ChartProps {
  done: number;
  inProgress: number;
  todo: number;
  dailyTrend: { date: string; count: number }[];
  projectBreakdown: { name: string; count: number }[];
  assigneeBreakdown: { name: string; count: number }[];
  isDark: boolean;
  trendMode: "line" | "bar";
  labels: {
    status: string;
    trend: string;
    project: string;
    assignee: string;
    tasksCount: string;
    done: string;
    inProgress: string;
    todo: string;
  };
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b"];

export const RechartsSummary: React.FC<ChartProps> = ({
  done,
  inProgress,
  todo,
  dailyTrend,
  projectBreakdown,
  assigneeBreakdown,
  isDark,
  trendMode,
  labels,
}) => {
  const statusData = [
    { name: labels.done, value: done },
    { name: labels.inProgress, value: inProgress },
    { name: labels.todo, value: todo },
  ];

  const textColor = isDark ? "#dbe7ff" : "#1f2a44";
  const gridColor = isDark
    ? "rgba(148,163,184,0.15)"
    : "rgba(100,116,139,0.15)";
  const tooltipStyle = {
    backgroundColor: isDark ? "#1e293b" : "#fff",
    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
    borderRadius: "12px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    fontSize: "12px",
    padding: "8px 12px",
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 py-4">
      {/* Status Chart */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 bg-white/90 dark:bg-gray-800/70 shadow-sm h-80 flex flex-col transition-colors">
        <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
          {labels.status}
        </h4>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {statusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: textColor }}
                cursor={{ stroke: gridColor, strokeWidth: 2 }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value) => (
                  <span
                    style={{
                      color: textColor,
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 bg-white/90 dark:bg-gray-800/70 shadow-sm h-80 flex flex-col transition-colors">
        <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
          {labels.trend}
        </h4>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            {trendMode === "line" ? (
              <AreaChart
                data={dailyTrend}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke={textColor}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val.split("-").slice(1).join("/")}
                  dy={10}
                />
                <YAxis
                  stroke={textColor}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: textColor }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name={labels.tasksCount}
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorCount)"
                  strokeWidth={3}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={dailyTrend}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke={textColor}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val.split("-").slice(1).join("/")}
                  dy={10}
                />
                <YAxis
                  stroke={textColor}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: textColor }}
                />
                <Bar
                  dataKey="count"
                  name={labels.tasksCount}
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project Chart */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 bg-white/90 dark:bg-gray-800/70 shadow-sm h-80 flex flex-col transition-colors">
        <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-violet-500 rounded-full"></span>
          {labels.project}
        </h4>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={projectBreakdown.slice(0, 6)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridColor}
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke={textColor}
                fontSize={10}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke={textColor}
                fontSize={10}
                width={80}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) =>
                  val.length > 12 ? `${val.slice(0, 10)}...` : val
                }
              />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: textColor }}
                cursor={{ fill: "transparent" }}
              />
              <Bar
                dataKey="count"
                name={labels.tasksCount}
                fill="#8b5cf6"
                radius={[0, 6, 6, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Assignee Chart */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 bg-white/90 dark:bg-gray-800/70 shadow-sm h-80 flex flex-col transition-colors">
        <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
          {labels.assignee}
        </h4>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={assigneeBreakdown.slice(0, 6)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridColor}
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke={textColor}
                fontSize={10}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke={textColor}
                fontSize={10}
                width={80}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) =>
                  val.length > 12 ? `${val.slice(0, 10)}...` : val
                }
              />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: textColor }}
                cursor={{ fill: "transparent" }}
              />
              <Bar
                dataKey="count"
                name={labels.tasksCount}
                fill="#0891b2"
                radius={[0, 6, 6, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
