import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store.jsx';
import Shell from './Shell.jsx';
import Home from './pages/Home.jsx';
import Opportunities from './pages/Opportunities.jsx';
import CreateOpportunity from './pages/CreateOpportunity.jsx';
import OpportunityDetail from './pages/OpportunityDetail.jsx';
import AssessmentBuilder from './pages/AssessmentBuilder.jsx';
import SendAssessment from './pages/SendAssessment.jsx';
import RankList from './pages/RankList.jsx';
import Compare from './pages/Compare.jsx';
import CandidatePool from './pages/CandidatePool.jsx';
import CandidateFlow from './pages/CandidateFlow.jsx';
import CandidateReport from './pages/CandidateReport.jsx';
import Billing from './pages/Billing.jsx';
import Profile from './pages/Profile.jsx';
import Support from './pages/Support.jsx';
import Login from './pages/Login.jsx';
import AdminShell from './AdminShell.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import AdminClients from './pages/AdminClients.jsx';
import AdminClientDetail from './pages/AdminClientDetail.jsx';
import OnboardClient from './pages/OnboardClient.jsx';
import AdminPlans from './pages/AdminPlans.jsx';
import AdminBilling from './pages/AdminBilling.jsx';
import AdminCatalog from './pages/AdminCatalog.jsx';
import AdminSupport from './pages/AdminSupport.jsx';
import AdminCompliance from './pages/AdminCompliance.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/opportunities/new" element={<CreateOpportunity />} />
            <Route path="/opportunities/:id" element={<OpportunityDetail />} />
            <Route path="/opportunities/:id/assessment" element={<AssessmentBuilder />} />
            <Route path="/opportunities/:id/send" element={<SendAssessment />} />
            <Route path="/opportunities/:id/rank" element={<RankList />} />
            <Route path="/opportunities/:id/candidate/:cid" element={<CandidateReport />} />
            <Route path="/opportunities/:id/compare" element={<Compare />} />
            <Route path="/opportunities/:id/pool" element={<CandidatePool />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/support" element={<Support />} />
          </Route>
          <Route path="/candidate/:id" element={<CandidateFlow />} />
          <Route path="/login" element={<Login />} />
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/clients/new" element={<OnboardClient />} />
            <Route path="/admin/clients/:id" element={<AdminClientDetail />} />
            <Route path="/admin/plans" element={<AdminPlans />} />
            <Route path="/admin/billing" element={<AdminBilling />} />
            <Route path="/admin/catalog" element={<AdminCatalog />} />
            <Route path="/admin/support" element={<AdminSupport />} />
            <Route path="/admin/compliance" element={<AdminCompliance />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  </React.StrictMode>
);
