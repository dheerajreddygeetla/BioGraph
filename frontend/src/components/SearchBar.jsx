import React, { useState } from 'react';
import axios from 'axios';

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(
        `http://localhost:5000/api/graph/search?q=${encodeURIComponent(value)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestions(data);
    } catch (err) {
      console.error(err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (entity) => {
    setQuery(entity.name);
    setSuggestions([]);
    onSearch(entity._id);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      // if no suggestion selected, use query as search string (maybe try exact match)
      onSearch(query.trim());
    }
  };

  return (
    <div className="relative max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search for a gene, disease, drug..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition"
        >
          Search
        </button>
      </form>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-20">
          {suggestions.map((entity) => (
            <li
              key={entity._id}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
              onClick={() => handleSelect(entity)}
            >
              <span className="font-medium">{entity.name}</span>
              <span className="text-sm text-gray-500">{entity.type}</span>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <div className="absolute left-0 right-0 mt-1 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-2">
          Searching...
        </div>
      )}
    </div>
  );
};

export default SearchBar;