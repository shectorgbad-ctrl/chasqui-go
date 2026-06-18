import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Welcome } from './views/Welcome';
import { DocumentVerification } from './views/DocumentVerification';
import { ClientDashboard } from './views/ClientDashboard';
import { DriverDashboard } from './views/DriverDashboard';
import './App.css';

const AppContent: React.FC = () => {
  const { step, user } = useApp();

  switch (step) {
    case 'welcome':
    case 'role_select':
    case 'register':
    case 'sms':
      return <Welcome />;
    case 'verification':
      return <DocumentVerification />;
    case 'dashboard':
      if (user?.role === 'driver') {
        return <DriverDashboard />;
      } else {
        return <ClientDashboard />;
      }
    default:
      return <Welcome />;
  }
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
