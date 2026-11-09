import { Navigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { landingPath, useUser } from '../state/user';
import { Overview } from '../pages/Overview';
import { Recently } from '../pages/Recently';
import { FilesPage, FileDetailPage } from '../pages/Files';
import { BoardsPage, BoardDetailPage } from '../pages/Boards';
import { ProcessesPage, RunDetailPage } from '../pages/Processes';
import { NotesPage } from '../pages/Notes';
import { ChatPage } from '../pages/chat/ChatPage';
import { UserPage } from '../pages/user/UserPage';
import { ComputeOverview } from '../pages/compute/ComputeOverview';
import { ComputeBackends } from '../pages/compute/ComputeBackends';
import { ComputeAddBackend } from '../pages/compute/ComputeAddBackend';
import { ComputeBackendDetail } from '../pages/compute/ComputeBackendDetail';
import { ComputeRun } from '../pages/compute/ComputeRun';
import { ComputeInstances } from '../pages/compute/ComputeInstances';
import { ComputeInstanceDetail } from '../pages/compute/ComputeInstanceDetail';
import { ComputeActivity } from '../pages/compute/ComputeActivity';
import { ComputeWorkloadDetail } from '../pages/compute/ComputeWorkloadDetail';
import { ComputeMarketplace, ComputeListingDetail } from '../pages/compute/ComputeMarketplace';
import {
  ConnectConnected,
  ConnectCustom,
  ConnectDiscover,
  ConnectAppDetail,
  ConnectIntegrationDetail,
} from '../pages/connect/ConnectPages';
import { NotFound } from '../pages/NotFound';

function WorkspaceRedirect() {
  const { wsId = '' } = useParams();
  return <Navigate to={routes.files(wsId)} replace />;
}

/** The index route goes where the person asked to land. One read per visit:
    the redirect is a navigation, not a subscription. */
function LandingRedirect() {
  const user = useUser();
  return <Navigate to={landingPath(user)} replace />;
}

export const routerChildren = [
  { index: true, element: <LandingRedirect /> },
  { path: 'overview', element: <Overview /> },
  { path: 'recently', element: <Recently /> },
  { path: 'w/:wsId', element: <WorkspaceRedirect /> },
  { path: 'w/:wsId/files', element: <FilesPage /> },
  { path: 'w/:wsId/files/:fileId', element: <FileDetailPage /> },
  { path: 'w/:wsId/boards', element: <BoardsPage /> },
  { path: 'w/:wsId/boards/:boardId', element: <BoardDetailPage /> },
  { path: 'w/:wsId/processes', element: <ProcessesPage /> },
  { path: 'w/:wsId/processes/:runId', element: <RunDetailPage /> },
  { path: 'notes', element: <NotesPage /> },
  { path: 'notes/:noteId', element: <NotesPage /> },
  { path: 'chat', element: <ChatPage /> },
  { path: 'chat/:conversationId', element: <ChatPage /> },
  /* `backends/new` before the dynamic detail route: React Router prefers a
     static segment, but the order says what was meant. */
  { path: 'compute', element: <ComputeOverview /> },
  { path: 'compute/backends', element: <ComputeBackends /> },
  { path: 'compute/backends/new', element: <ComputeAddBackend /> },
  { path: 'compute/backends/:backendId', element: <ComputeBackendDetail /> },
  { path: 'compute/run', element: <ComputeRun /> },
  { path: 'compute/instances', element: <ComputeInstances /> },
  { path: 'compute/instances/:instanceId', element: <ComputeInstanceDetail /> },
  { path: 'compute/activity', element: <ComputeActivity /> },
  { path: 'compute/activity/:workloadId', element: <ComputeWorkloadDetail /> },
  { path: 'compute/marketplace', element: <ComputeMarketplace /> },
  { path: 'compute/marketplace/:listingId', element: <ComputeListingDetail /> },
  { path: 'account', element: <Navigate to={routes.user()} replace /> },
  { path: 'account/:section', element: <Navigate to={routes.user()} replace /> },
  { path: 'user', element: <Navigate to={routes.user()} replace /> },
  { path: 'user/:section', element: <UserPage /> },
  { path: 'connect', element: <ConnectConnected /> },
  { path: 'connect/discover', element: <ConnectDiscover /> },
  { path: 'connect/custom', element: <ConnectCustom /> },
  { path: 'connect/apps/:appId', element: <ConnectAppDetail /> },
  { path: 'connect/i/:integrationId', element: <ConnectIntegrationDetail /> },
  { path: '*', element: <NotFound /> },
];
