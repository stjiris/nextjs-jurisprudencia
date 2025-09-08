import React from 'react';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import Head from 'next/head';

export default function AnalyticsPage() {
  return (
    <>
      <Head>
        <title>Análise de Frequência Temporal - JurisDev</title>
        <meta name="description" content="Análise de frequência temporal de termos em jurisprudência com pesquisa de texto livre e campos de metadados." />
      </Head>
      
      <div style={{ 
        minHeight: '100vh', 
        background: '#f8f9fa',
        padding: '1rem 0'
      }}>
        <AnalyticsDashboard />
      </div>
    </>
  );
} 