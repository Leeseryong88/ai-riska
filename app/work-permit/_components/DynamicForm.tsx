'use client';

import React from 'react';
import { FormField } from '../_lib/types';
import { Input, Label } from './ui/Button';
import { cn } from '../_lib/utils';

/** datetime-local 값에서 yyyy-MM-dd만 추출 (date input min/max용) */
function sliceDateKey(v: string): string | undefined {
  if (!v) return undefined;
  const t = v.indexOf('T');
  if (t >= 0) return v.slice(0, 10);
  return v.length >= 10 ? v.slice(0, 10) : undefined;
}

/** 작업 시작/종료 필드에 브라우저 네이티브 제한(min/max) 적용 */
function workPeriodInputBounds(
  field: FormField,
  values: Record<string, any>
): { min?: string; max?: string } {
  const { id, type } = field;
  if (type === 'datetime-local') {
    if (id === 'work_end' && values.work_start) return { min: values.work_start };
    if (id === 'work_start' && values.work_end) return { max: values.work_end };
  }
  if (type === 'date') {
    if (id === 'work_end_date') {
      const min =
        values.work_start_date ||
        (values.work_start ? sliceDateKey(String(values.work_start)) : undefined);
      return min ? { min } : {};
    }
    if (id === 'work_start_date') {
      const max =
        values.work_end_date ||
        (values.work_end ? sliceDateKey(String(values.work_end)) : undefined);
      return max ? { max } : {};
    }
  }
  return {};
}

interface DynamicFormProps {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (id: string, value: any) => void;
  errors?: Record<string, string>;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({ fields, values, onChange, errors }) => {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <Label htmlFor={field.id} className={cn(field.required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
            {field.label}
          </Label>
          
          {field.type === 'textarea' ? (
            <textarea
              id={field.id}
              className={cn(
                'flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
                errors?.[field.id] && 'border-red-500'
              )}
              placeholder={field.placeholder}
              value={values[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              required={field.required}
            />
          ) : field.type === 'select' ? (
            <select
              id={field.id}
              className={cn(
                'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
                errors?.[field.id] && 'border-red-500'
              )}
              value={values[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              required={field.required}
            >
              <option value="">선택해 주세요</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : field.type === 'radio' ? (
            <div className="flex flex-wrap gap-4 pt-1">
              {field.options?.map((opt) => (
                <label key={opt} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.id}
                    value={opt}
                    checked={values[field.id] === opt}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    required={field.required}
                  />
                  <span className="text-sm text-gray-700">{opt}</span>
                </label>
              ))}
            </div>
          ) : field.type === 'checkbox' ? (
            <div className="flex flex-wrap gap-4 pt-1">
              {field.options?.map((opt) => (
                <label key={opt} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt}
                    checked={(values[field.id] || []).includes(opt)}
                    onChange={(e) => {
                      const current = values[field.id] || [];
                      const next = e.target.checked
                        ? [...current, opt]
                        : current.filter((v: string) => v !== opt);
                      onChange(field.id, next);
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <Input
              id={field.id}
              type={field.type}
              placeholder={field.placeholder}
              value={values[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              className={cn(errors?.[field.id] && 'border-red-500')}
              required={field.required}
              {...(field.type === 'datetime-local' || field.type === 'date'
                ? workPeriodInputBounds(field, values)
                : {})}
            />
          )}
          
          {errors?.[field.id] && (
            <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>
          )}
        </div>
      ))}
    </div>
  );
};
