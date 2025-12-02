"use client";

const EngagementCard = () => {
    const barHeights = [40, 55, 70, 85, 100];
    
    return (
      <div className="bg-gradient-to-br from-[#1a1b1e] via-[#252629] to-[#0d0d0e]  backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10 w-80 h-64">
        <div className="text-center mb-6">
          <h3 className="text-3xl font-bold text-white mb-2">+75.12%</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Increase in user engagement from Voice AI responses.
          </p>
        </div>
        
        <div className="flex items-end justify-center space-x-3 h-20">
          {barHeights.map((height, index) => (
            <div
              key={index}
              className="bg-white rounded-t-sm transition-all duration-1000 ease-out"
              style={{ 
                height: `${height}%`, 
                width: '16px',
                animationDelay: `${index * 200}ms`
              }}
            />
          ))}
        </div>
      </div>
    );
  };

const SpikeGraphCard = () => {
    const points = [
      { x: 10, y: 80 },
      { x: 25, y: 60 },
      { x: 40, y: 70 },
      { x: 55, y: 45 },
      { x: 70, y: 25 },
      { x: 85, y: 15 }
    ];
    
    const pathData = points.map((point, index) => 
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ');
    
    return (
      <div className="bg-gradient-to-br from-[#1a1b1e] via-[#252629] to-[#0d0d0e]  backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10 w-80 h-64">
        <div className="text-center mb-6">
          <h3 className="text-3xl font-bold text-white mb-2">+21.35%</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Revenue spike after integrating our voice agents.
          </p>
        </div>
        
        <div className="relative h-20">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {/* Grid background */}
            <g>
              {/* Horizontal grid lines */}
              {[20, 40, 60, 80].map((y) => (
                <line
                  key={`h-${y}`}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="#374151"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                  opacity="0.5"
                />
              ))}
              
              {/* Vertical grid lines */}
              {[20, 40, 60, 80].map((x) => (
                <line
                  key={`v-${x}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="100"
                  stroke="#374151"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                  opacity="0.5"
                />
              ))}
            </g>
            
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            
            <path
              d={pathData}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              className="animate-pulse"
            />
            
            {/* Peak point */}
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3"
              fill="#60a5fa"
              className="animate-pulse"
            />
          </svg>
        </div>
      </div>
    );
  };

const SystemSummaryCard = () => {
    const percentage = 83;
    const circumference = 2 * Math.PI * 45;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    return (
      <div className="bg-gradient-to-br from-[#1a1b1e] via-[#252629] to-[#0d0d0e]  backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10 w-80 h-64">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-white mb-2">AI Handling 83% of Inbound Calls</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Based on last month's usage
          </p>
        </div>
        
        <div className="flex items-center justify-center">
          <div className="relative w-24 h-24">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#374151"
                strokeWidth="8"
              />
              
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#pieGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
              
              <defs>
                <linearGradient id="pieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#9ca3af" />
                </linearGradient>
              </defs>
            </svg>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-lg">{percentage}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

const TestimonialCard = () => {
    return (
      <div className="bg-gradient-to-br from-[#1a1b1e] via-[#252629] to-[#0d0d0e]  backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10 w-80 h-64">
        <div className="text-center">
          <blockquote className="text-white text-lg mb-6 leading-relaxed">
            "Voice AI agents made our outreach 10x smarter."
          </blockquote>
          
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-lg">SA</span>
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Sarah Ahmed</p>
              <p className="text-gray-400 text-sm">Growth Marketer</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

const TotalCallsCard = () => {
    return (
      <div className="bg-gradient-to-br from-[#1a1b1e] via-[#252629] to-[#0d0d0e]  backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10 w-80 h-64">
        <div className="text-center mb-6">
          <h3 className="text-3xl font-bold text-white mb-2">$527.8K</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Total value generated from Voice AI calls this month.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
            <span>Social Media</span>
            <span>TV & Radio</span>
            <span>Billboards</span>
          </div>
          
          <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#60a5fa] to-[#3b82f6] rounded-l-full" style={{ width: '40%' }}></div>
            <div className="absolute left-[40%] top-0 h-full bg-gradient-to-r from-[#fcd34d] to-[#f59e0b]" style={{ width: '35%' }}></div>
            <div className="absolute right-0 top-0 h-full bg-gradient-to-r from-[#a0aec0] to-[#718096] rounded-r-full" style={{ width: '25%' }}></div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-400">
            <span>40%</span>
            <span>35%</span>
            <span>25%</span>
          </div>
        </div>
      </div>
    );
  };
  
// Export all card components
export { 
  EngagementCard, 
  SpikeGraphCard, 
  SystemSummaryCard, 
  TestimonialCard, 
  TotalCallsCard 
};