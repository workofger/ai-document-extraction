import React from 'react';
import { Briefcase, User, Truck, Building, UserCheck } from 'lucide-react';
import { useDocuments } from '@/contexts/DocumentContext';
import { RequirementType } from '@/types';
import { ROLES } from '@/constants';

export const RoleSelector: React.FC = () => {
  const { state, setRole, stats } = useDocuments();
  const currentRole = ROLES.find(r => r.id === state.selectedRole);

  const getRoleIcon = (roleId: RequirementType, size = 20) => {
    const props = { size, className: 'flex-shrink-0' };
    switch (roleId) {
      case RequirementType.Encargado:
        return <Briefcase {...props} />;
      case RequirementType.Conductor:
        return <User {...props} />;
      case RequirementType.Vehiculo:
        return <Truck {...props} />;
      case RequirementType.PersonaMoral:
        return <Building {...props} />;
      case RequirementType.PersonaFisica:
        return <UserCheck {...props} />;
      default:
        return <User {...props} />;
    }
  };

  const getRoleGradient = (roleId: RequirementType): string => {
    switch (roleId) {
      case RequirementType.Encargado:
        return 'from-amber-500 to-orange-500';
      case RequirementType.Conductor:
        return 'from-blue-500 to-cyan-500';
      case RequirementType.Vehiculo:
        return 'from-green-500 to-emerald-500';
      case RequirementType.PersonaMoral:
        return 'from-purple-500 to-pink-500';
      case RequirementType.PersonaFisica:
        return 'from-teal-500 to-cyan-500';
      default:
        return 'from-pr-amber to-orange-500';
    }
  };

  return (
    <div className="card-elevated">
      {/* Header with gradient accent */}
      <div className="relative p-3 xl:p-4 pb-2 xl:pb-3">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pr-amber via-orange-500 to-pr-amber rounded-t-2xl" />
        <h3 className="text-[10px] xl:text-xs font-bold text-pr-muted uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-pr-amber rounded-full shadow-sm shadow-pr-amber/50" />
          Tipo de Validación
        </h3>
      </div>

      {/* Role Icons - Compact Grid */}
      <div className="px-3 xl:px-4 pb-3">
        <div className="flex justify-between gap-1">
          {ROLES.map((role) => {
            const isActive = state.selectedRole === role.id;
            const gradient = getRoleGradient(role.id);
            
            return (
              <button
                key={role.id}
                onClick={() => setRole(role.id)}
                className={`
                  relative flex items-center justify-center p-2.5 xl:p-3 rounded-xl
                  transition-all duration-300 flex-1
                  ${isActive 
                    ? 'bg-gradient-to-br ' + gradient + ' text-white shadow-lg scale-105' 
                    : 'bg-white/5 text-pr-muted hover:bg-white/10 hover:text-pr-white border border-white/5 hover:border-white/10'
                  }
                `}
                title={role.label}
              >
                {/* Active indicator glow */}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-white/10" />
                )}
                
                <div className="relative z-10">
                  {getRoleIcon(role.id, isActive ? 22 : 18)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Role Info Card */}
      <div className="px-3 xl:px-4 pb-3 xl:pb-4">
        <div className="relative overflow-hidden rounded-xl p-3 xl:p-4 bg-gradient-to-br from-pr-amber/10 to-orange-500/5 border border-pr-amber/20">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative flex items-center gap-3">
            <div className={`
              w-11 h-11 xl:w-12 xl:h-12 rounded-xl bg-gradient-to-br ${getRoleGradient(state.selectedRole)} 
              flex items-center justify-center text-white shadow-lg flex-shrink-0
            `}>
              {getRoleIcon(state.selectedRole, 22)}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-display font-bold text-sm xl:text-base text-pr-white">
                {currentRole?.label || ''}
              </h4>
              <p className="text-[10px] xl:text-xs text-pr-muted line-clamp-1 mt-0.5">
                {currentRole?.description || ''}
              </p>
            </div>

            <div className="flex flex-col items-end gap-0.5 flex-shrink-0 pl-2">
              <span className="text-lg xl:text-xl font-bold text-pr-white tabular-nums">
                {stats.valid}/{stats.total}
              </span>
              <span className="text-[9px] xl:text-[10px] text-pr-muted uppercase tracking-wider font-medium">
                Válidos
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
