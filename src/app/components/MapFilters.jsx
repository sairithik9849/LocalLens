'use client';

const MapFilters = ({ filters, onFilterChange }) => {
  const handleToggle = (key) => {
    onFilterChange({
      ...filters,
      [key]: !filters[key],
    });
  };

  return (
    <div className="bg-base-100/95 backdrop-blur-sm shadow-lg border-b border-base-300 px-4 py-3">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-wide mr-2">
          Layers:
        </h3>
        
        {/* Filter Toggle Buttons */}
        <div className="flex items-center gap-2">
          <FilterButton
            label="Weather"
            checked={filters.showWeather}
            onChange={() => handleToggle('showWeather')}
            icon="🌤️"
          />
          <FilterButton
            label="Incidents"
            checked={filters.showIncidents}
            onChange={() => handleToggle('showIncidents')}
            icon="🚨"
          />
          <FilterButton
            label="Events"
            checked={filters.showEvents}
            onChange={() => handleToggle('showEvents')}
            icon="📅"
          />
        </div>
      </div>
    </div>
  );
};

const FilterButton = ({ label, checked, onChange, icon }) => {
  return (
    <button
      onClick={onChange}
      className={`btn btn-sm gap-2 transition-all ${
        checked
          ? 'btn-primary'
          : 'btn-ghost'
      }`}
      aria-label={`Toggle ${label}`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {checked && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </button>
  );
};

export default MapFilters;

