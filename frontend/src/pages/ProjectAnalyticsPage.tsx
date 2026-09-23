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
  Clock,
  ArrowUpRight
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
  const backLabel = "Back to Workspace";

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
            description: 'Reliability Engineering Platform Workspace Node.',
            architecture: 'monolith',
            status: 'active'
          });
        }

        const testRes = await apiFetch(`${baseUrl}/api/project/test-runs/?project_id=${projectId}`, { headers });
        if (testRes.ok) {
          const testData = await testRes.json();
          setTestRuns(testData);
        }
      } catch (err: any) {
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
      <div className="space-y-3.5 pb-12">
        
        {/* Navigation Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <Link to="/dashboard" className="hover:text-zinc-300">Noir</Link>
              <span className="text-zinc-600">/</span>
              <Link to="/dashboard/projects" className="hover:text-zinc-300">Workspaces</Link>
              <span className="text-zinc-600">/</span>
              <Link to={backLink} className="hover:text-zinc-300 truncate max-w-[150px]">{project?.title || 'Node'}</Link>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-200">Analytics</span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <span>{project?.title} • Test History & Failure Logs</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-400">
                {testRuns.length} runs recorded
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={backLink}
              className="h-8 px-3 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-zinc-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backLabel}</span>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-10 w-full bg-zinc-900/60 rounded-md animate-pulse" />
            <div className="h-64 w-full bg-zinc-900/60 rounded-lg animate-pulse" />
          </div>
        ) : error ? (
          <div className="py-12 text-center bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-6">
            <Activity className="w-8 h-8 text-rose-500/60 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-zinc-200">Error Loading Analytics</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-[280px] mx-auto font-mono">{error}</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Test History Analytics Component */}
            <TestHistoryAnalytics testRuns={testRuns} isLoading={isLoading} />
          </div>
        )}
      </div>
    </UserLayout>
  );
}
