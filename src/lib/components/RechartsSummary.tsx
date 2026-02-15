import React, { useMemo, useState } from "react";
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
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";

interface ChartProps {
  done: number;
  inProgress: number;
  inTest: number;
  todo: number;
  dailyTrend: { date: string; count: number }[];
  projectBreakdown: { name: string; count: number }[];
  assigneeBreakdown: { name: string; count: number }[];
  categoryBreakdown: { name: string; count: number }[];
  isDark: boolean;
  trendMode: "line" | "bar";
  labels: {
    status: string;
    trend: string;
    project: string;
    assignee: string;
    category: string;
    prediction: string;
    predictionDesc: string;
    predictionNextMonth: string;
    predictionConfidence: string;
    predictionTasks: string;
    predictionExperimental: string;
    predictionHelpTitle: string;
    predictionHelpContent: string;
    tasksCount: string;
    done: string;
    inProgress: string;
    inTest: string;
    todo: string;
  };
}

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
];

export const RechartsSummary: React.FC<ChartProps> = ({
  done,
  inProgress,
  inTest,
  todo,
  dailyTrend,
  projectBreakdown,
  assigneeBreakdown,
  categoryBreakdown,
  isDark,
  trendMode,
  labels,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  // Simple Linear Regression for Prediction
  const prediction = useMemo(() => {
    if (dailyTrend.length < 2) return { nextMonthTotal: 0, confidence: 0 };

    // x = day index, y = task count
    const n = dailyTrend.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    dailyTrend.forEach((d, i) => {
      sumX += i;
      sumY += d.count;
      sumXY += i * d.count;
      sumX2 += i * i;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next 30 days
    let nextMonthTotal = 0;
    for (let i = n; i < n + 30; i++) {
      nextMonthTotal += Math.max(0, slope * i + intercept);
    }

    // Confidence based on R-Squared (simplified)
    const avgY = sumY / n;
    let ssRes = 0;
    let ssTot = 0;
    dailyTrend.forEach((d, i) => {
      const yPred = slope * i + intercept;
      ssRes += Math.pow(d.count - yPred, 2);
      ssTot += Math.pow(d.count - avgY, 2);
    });

    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    const confidence = Math.min(100, Math.max(0, rSquared * 100));

    return {
      nextMonthTotal: Math.round(nextMonthTotal),
      confidence: Math.round(confidence),
    };
  }, [dailyTrend]);

  const statusData = [
    { name: labels.done, value: done },
    { name: labels.inProgress, value: inProgress },
    { name: labels.inTest, value: inTest },
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
    fontSize: "11px",
    padding: "8px 12px",
  };

  return (
    <div className="space-y-6 py-4">
      {/* AI Prediction Row */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 p-6 bg-indigo-50/50 dark:bg-indigo-500/5 shadow-sm flex items-center gap-6 relative overflow-visible">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              <path d="M5 3v4" />
              <path d="M19 17v4" />
              <path d="M3 5h4" />
              <path d="M17 19h4" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                {labels.prediction}
                <span className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] rounded-full font-black uppercase tracking-widest">
                  {labels.predictionExperimental}
                </span>
              </h4>
            </div>
            <p className="text-sm text-indigo-700/70 dark:text-indigo-300/60 mt-1 font-medium italic">
              "{labels.predictionDesc}"
            </p>
          </div>
        </div>

        {/* RIGHT CARD (The one in the image) */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 bg-white/90 dark:bg-gray-800/70 shadow-sm flex flex-col justify-center relative overflow-visible">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {labels.predictionNextMonth}
            </p>
            <button
              className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 flex items-center justify-center text-[10px] font-bold hover:bg-primary hover:text-white transition-colors outline-none shrink-0"
              onMouseEnter={() => setShowHelp(true)}
              onMouseLeave={() => setShowHelp(false)}
              onClick={() => setShowHelp(!showHelp)}
            >
              i
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-primary dark:text-blue-400">
              {prediction.nextMonthTotal}
            </span>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
              {labels.predictionTasks}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${prediction.confidence > 70 ? "bg-emerald-500" : prediction.confidence > 40 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${prediction.confidence}%` }}
              ></div>
            </div>
            <span className="text-[10px] font-black text-gray-500">
              {prediction.confidence}%
            </span>
          </div>

          <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 font-medium">
            {labels.predictionConfidence}
          </p>

          {/* Help Tooltip Positioning for Right Card */}
          {showHelp && (
            <div className="absolute top-0 right-0 mt-12 mr-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 z-50 animate-fade-in pointer-events-none">
              <p className="text-xs font-bold text-gray-900 dark:text-white mb-1">
                {labels.predictionHelpTitle}
              </p>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                {labels.predictionHelpContent}
              </p>
              <div className="absolute top-0 right-4 -mt-2 w-4 h-4 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  innerRadius={60}
                  outerRadius={80}
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
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => (
                    <span
                      style={{
                        color: textColor,
                        fontSize: "11px",
                        fontWeight: 600,
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

        {/* Radar Chart for Categories */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 bg-white/90 dark:bg-gray-800/70 shadow-sm h-80 flex flex-col transition-colors lg:col-span-1">
          <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
            {labels.category}
          </h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="75%"
                data={categoryBreakdown.slice(0, 6)}
              >
                <PolarGrid stroke={gridColor} />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fill: textColor, fontSize: 10, fontWeight: 500 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Radar
                  name={labels.tasksCount}
                  dataKey="count"
                  stroke="#ec4899"
                  fill="#ec4899"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 bg-white/90 dark:bg-gray-800/70 shadow-sm h-80 flex flex-col transition-colors md:col-span-2 lg:col-span-1">
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
                  barSize={16}
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
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
