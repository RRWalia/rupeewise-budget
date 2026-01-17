import { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { calculateCategorySpending, mockTransactions, CATEGORY_ICONS } from '@/lib/mockData';

export function SpendingPieChart() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const categoryData = calculateCategorySpending(mockTransactions);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="flex items-center gap-2 font-medium text-card-foreground">
            <span>{data.icon}</span>
            {data.category}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(data.amount)} ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <h3 className="mb-4 font-display text-lg font-semibold text-card-foreground">
        Spending by Category
      </h3>
      
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="h-[220px] w-full lg:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                dataKey="amount"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {categoryData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                    className="cursor-pointer transition-opacity duration-200"
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:w-1/2">
          {categoryData.map((item, index) => (
            <motion.div
              key={item.category}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              className={`flex items-center gap-2 rounded-lg p-2 transition-colors ${
                activeIndex === index ? 'bg-secondary' : ''
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-xs font-medium text-card-foreground">
                  <span>{item.icon}</span>
                  {item.category}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(item.amount)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
