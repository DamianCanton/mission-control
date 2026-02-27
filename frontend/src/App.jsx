import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LiveFeed from './components/LiveFeed';
import Agents from './components/Agents';
import { useMissionStore } from './store/useMissionStore';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const connect = useMissionStore(state => state.connect);
  const disconnect = useMissionStore(state => state.disconnect);

  useEffect(() => {
    // Inicia la conexión de Socket.io al montar la App
    connect();

    return () => {
      // Limpia la conexión al desmontar
      disconnect();
    };
  }, [connect, disconnect]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'livefeed':
        return <LiveFeed />;
      case 'agents':
        return <Agents />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentView={currentView} setCurrentView={setCurrentView}>
      {renderView()}
    </Layout>
  );
}

export default App;