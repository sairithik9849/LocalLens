'use client';

import { useState } from 'react';

const MapFilters = ({ filters, onFilterChange }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleToggle = (key) => {
    onFilterChange({
      ...filters,
      [key]: !filters[key],
    });
  };

  const handleTagToggle = (tag) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    
    onFilterChange({
      ...filters,
      tags: newTags,
    });
  };

  // Dummy tags for demonstration
  const availableTags = ['Safety', 'Community', 'Traffic', 'Weather', 'Events', 'Crime', 'Rent'];

  return (
    <div className={`bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ${
      isOpen ? 'w-80' : 'w-16'
    } flex flex-col border-r border-gray-200 dark:border-gray-700`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className={`font-bold text-xl text-gray-800 dark:text-gray-200 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
        }`}>
          Map Filters
        </h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <svg
            className={`w-5 h-5 text-gray-600 dark:text-gray-300 transition-transform ${
              isOpen ? '' : 'rotate-180'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Layer Toggles */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Layers
            </h3>
            <div className="space-y-2">
              <LayerToggle
                label="Alerts"
                checked={filters.showAlerts}
                onChange={() => handleToggle('showAlerts')}
                icon="🚨"
              />
              <LayerToggle
                label="Events"
                checked={filters.showEvents}
                onChange={() => handleToggle('showEvents')}
                icon="📅"
              />
              <LayerToggle
                label="Trends"
                checked={filters.showTrends}
                onChange={() => handleToggle('showTrends')}
                icon="📊"
              />
            </div>
          </div>

          {/* Tag Filters */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Filter by Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filters.tags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LayerToggle = ({ label, checked, onChange, icon }) => {
  return (
    <label className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
      />
    </label>
  );
};

export default MapFilters;

