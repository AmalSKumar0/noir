import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  FlaskConical, 
  BarChart3, 
  Layers, 
  Terminal, 
  Activity,
  Check,
  Copy,
  Calendar,
  Clock
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import TestHistoryAnalytics, { TestRunItem } from '../components/TestHistoryAnalytics';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';

interface ProjectDetailData {
  id: number;
  connection_code: string;
  title: string;
  description: string;
  architecture: string;
  status: string;
}

export default function ProjectAnalyticsPage({ isCompanyView = false }: { isCompanyView?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [testRuns, setTestRuns] = useState<TestRunItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const backLink = isCompanyView ? `/company/projects/${projectId}` : `/dashboard/projects/${projectId}`;
  const backLabel = "Back to Project Overview";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await checkAndRefreshToken();
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        const projRes = await apiFetch(`${baseUrl}/api/project/${projectId}/`, { headers });
        if (projRes.ok) {
          const pData = await projRes.json();
          setProject(pData);
        } else {
          setProject({
            id: Number(projectId),
            connection_code: 'NR-KO2Y3DZZ',
            title: `Project #${projectId}`,
            description: 'Reliability Engineering Telemetry Node.',
            architecture: 'monolith',
            status: 'active'
          });
        }

        // Fetch Test Runs
        const testRes = await apiFetch(`${baseUrl}/api/project/test-runs/?project_id=${projectId}`, { headers });
        if (testRes.ok) {
          const tData = await testRes.json();
          setTestRuns(tData);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load project analytics data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    window.addEventListener('noir_run_completed', fetchData);
    return () => {
      window.removeEventListener('noir_run_completed', fetchData);
    };
  }, [projectId]);

  return (
    <UserLayout>
      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4 md:px-8 pb-24 text-white space-y-8">
        
        {/* Navigation Breadcrumb */}
        <Link 
          to={backLink} 
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="w-1/3 h-10 rounded-xl bg-white/5" />
            <Skeleton className="w-full h-64 rounded-[2.5rem] bg-white/5" />
          </div>
        ) : error ? (
          <div className="py-16 text-center bg-white/5 border border-white/10 rounded-[2rem] p-6">
            <Activity className="w-12 h-12 text-rose-500/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">Error Loading Analytics</h3>
            <p className="text-xs text-white/50 mt-1 max-w-[280px] mx-auto font-mono">{error}</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header Title Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/5">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-violet-400" />
                    {project?.title} • Reliability Analytics
                  </h1>
                </div>
                <p className="text-sm text-white/50 mt-1 font-light">
                  Historical test run matrix, failure analytics, and stdout/stderr log inspector.
                </p>
              </div>

              {/* Sub-page Navigation Tabs */}
              <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 font-mono text-xs">
                <Link
                  to={backLink}
                  className="px-4 py-2 rounded-xl text-white/40 hover:text-white transition-all"
                >
                  Overview & Live Logs
                </Link>
                <button
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold transition-all"
                >
                  Test Analytics & History
                </button>
              </div>
            </div>

            {/* Test History Analytics Sub-Page Component */}
            <TestHistoryAnalytics testRuns={testRuns} isLoading={isLoading} />
          </motion.div>
        )}
      </div>
    </UserLayout>
  );
}
